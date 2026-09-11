// Trains the fly: the FlyWire circuit (PN -> KC -> MBON edges) stays fixed, the input projection,
// the KC thresholds and the readout are fitted by gradient descent on the training games.
// Evaluation uses the game's own scoring on held-out games (public/fly/test-ids.json never trains).
//
//   node scripts/fly/train.mjs                 # train, evaluate, write public/fly/model.json + metrics.json
//   node scripts/fly/train.mjs --dry           # train and report, write nothing
//   node scripts/fly/train.mjs --epochs=120 --lr=0.002 --readout=all|256 --ablation --fixtures
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { featureVector, predict } from '../../src/lib/fly/network.js';
import { hashSeed, mulberry32, seededShuffle } from '../../src/lib/rng.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FLY = path.join(ROOT, 'public', 'fly');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const EPOCHS = Number(args.epochs || 140);
const LR = Number(args.lr || 0.002);
const BATCH = Number(args.batch || 32);
const WD = Number(args.wd || 1e-4);
const SEED = Number(args.seed || 20260911);
const READOUT = args.readout || 'all';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------------------------------------------------------------- data
const gamesFile = path.join(ROOT, 'public', 'data', 'games.json');
const dataset = JSON.parse(fs.readFileSync(gamesFile, 'utf8'));
const base = JSON.parse(fs.readFileSync(path.join(FLY, 'model.json'), 'utf8'));
const testIds = new Set(JSON.parse(fs.readFileSync(path.join(FLY, 'test-ids.json'), 'utf8')));
const norm = (g) => ({ ...g, tags: g.tags || [], dev: g.dev || [], pub: g.pub || [], platforms: g.platforms || [] });
const all = dataset.games.filter((g) => g && typeof g.reviews === 'number' && g.reviews > 0).map(norm);
const test = all.filter((g) => testIds.has(g.id));
const rest = seededShuffle(all.filter((g) => !testIds.has(g.id)), mulberry32(hashSeed(String(SEED)) % 4294967296));
const nVal = Math.round(rest.length * 0.104);
const val = rest.slice(0, nVal);
const train = rest.slice(nVal);
log(`games ${all.length}: train ${train.length}, validation ${val.length}, test ${test.length}`);

const LOGMAX = Math.log10(5000001);
const sample = (g) => ({ x: Float64Array.from(featureVector(g, base)), t0: Math.log10(g.reviews + 1), t1: g.pos / g.reviews, g });
const TR = train.map(sample);
const VA = val.map(sample);
const TE = test.map(sample);
const D = TR[0].x.length;
const mean0 = TR.reduce((s, r) => s + r.t0, 0) / TR.length;
const mean1 = TR.reduce((s, r) => s + r.t1, 0) / TR.length;
const std0 = Math.sqrt(TR.reduce((s, r) => s + (r.t0 - mean0) ** 2, 0) / TR.length);
const std1 = Math.sqrt(TR.reduce((s, r) => s + (r.t1 - mean1) ** 2, 0) / TR.length);

// ---------------------------------------------------------------- scoring (same formulas as src/lib/scoring.js)
function roundScore(guess, actual) { return Math.round(5000 * Math.max(0, 1 - Math.abs(Math.log10(guess + 1) - Math.log10(actual + 1)) / 1.5)); }
function bonusScore(pct, actualPct) { return Math.round(1000 * Math.max(0, 1 - Math.abs(pct - actualPct) / 30)); }
function toGuess(y0, y1) {
  return { reviews: Math.round(Math.max(0, Math.min(5000000, 10 ** Math.max(0, Math.min(LOGMAX, y0)) - 1))), pct: Math.round(Math.max(0, Math.min(100, y1 * 100))) };
}
function evaluate(rows, fn) {
  let score = 0, logErr = 0, pctErr = 0, within2 = 0;
  for (const r of rows) {
    const [y0, y1] = fn(r);
    const p = toGuess(y0, y1);
    const actualPct = Math.round((r.g.pos / r.g.reviews) * 100);
    score += roundScore(p.reviews, r.g.reviews) + bonusScore(p.pct, actualPct);
    const e = Math.abs(Math.log10(p.reviews + 1) - Math.log10(r.g.reviews + 1));
    logErr += e; pctErr += Math.abs(p.pct - actualPct); if (e <= Math.log10(2)) within2++;
  }
  const n = rows.length;
  return { score: +(score / n).toFixed(2), reviewFactor: +(10 ** (logErr / n)).toFixed(3), pctMAE: +(pctErr / n).toFixed(2), within2x: +((within2 / n) * 100).toFixed(2) };
}

// ---------------------------------------------------------------- the circuit
const nPN = base.nPN, nKC = base.nKC, nMBON = base.nMBON;
function buildGraph(edges1, edges2) {
  // edge lists as typed arrays: the inner loops run ~200M edge visits per epoch
  const pack = (edges) => ({ n: edges.length, a: Int32Array.from(edges, (e) => e[0]), b: Int32Array.from(edges, (e) => e[1]), w: Float64Array.from(edges, (e) => e[2]) });
  return { e1: pack(edges1), e2: pack(edges2) };
}

function initParams(rng) {
  const W = new Float64Array(nPN * D);
  const b = new Float64Array(nPN);
  // start from the fixed sparse projection of the previous model, plus small noise everywhere
  base.projection.forEach((p, i) => { p.indices.forEach((j, k) => { W[i * D + j] = p.weights[k]; }); b[i] = p.bias; });
  for (let i = 0; i < W.length; i++) W[i] += (rng() - 0.5) * 0.05;
  const theta = Float64Array.from(base.thresholds);
  const readoutKC = READOUT === 'all' ? Array.from({ length: nKC }, (_, i) => i) : base.readoutKC.slice();
  const R = readoutKC.length + nMBON;
  const Wr = new Float64Array(R * 2);
  for (let i = 0; i < Wr.length; i++) Wr[i] = (rng() - 0.5) * 0.02;
  const br = new Float64Array(2);
  return { W, b, theta, Wr, br, readoutKC };
}

function forward(P, G, x, cache) {
  const { W, b, theta, Wr, br, readoutKC } = P;
  const drive = cache.drive, pn = cache.pn, kcin = cache.kcin, kc = cache.kc, mbin = cache.mbin, mb = cache.mb;
  for (let i = 0; i < nPN; i++) {
    let d = b[i]; const off = i * D;
    for (let j = 0; j < D; j++) d += W[off + j] * x[j];
    drive[i] = d; const c = Math.max(-30, Math.min(30, d)); pn[i] = 1 / (1 + Math.exp(-c));
  }
  kcin.fill(0);
  for (let i = 0; i < G.e1.n; i++) kcin[G.e1.b[i]] += pn[G.e1.a[i]] * G.e1.w[i];
  for (let k = 0; k < nKC; k++) kc[k] = Math.max(0, kcin[k] - theta[k]) * 3;
  mbin.fill(0);
  for (let i = 0; i < G.e2.n; i++) mbin[G.e2.b[i]] += kc[G.e2.a[i]] * G.e2.w[i];
  for (let m = 0; m < nMBON; m++) mb[m] = Math.tanh(mbin[m] * 2);
  const R = readoutKC.length + nMBON;
  let y0 = br[0], y1 = br[1];
  for (let r = 0; r < R; r++) { const v = r < readoutKC.length ? kc[readoutKC[r]] : mb[r - readoutKC.length]; y0 += v * Wr[r * 2]; y1 += v * Wr[r * 2 + 1]; }
  return [y0, y1];
}

function makeCache() {
  return { drive: new Float64Array(nPN), pn: new Float64Array(nPN), kcin: new Float64Array(nKC), kc: new Float64Array(nKC), mbin: new Float64Array(nMBON), mb: new Float64Array(nMBON), dkc: new Float64Array(nKC), dmb: new Float64Array(nMBON), dpn: new Float64Array(nPN) };
}

// Gradients of the loss for one sample, accumulated into grads (same shapes as params).
function backward(P, G, x, y, t, cache, grads) {
  const { W, theta, Wr, readoutKC } = P;
  const { pn, kcin, kc, mb, drive, dkc, dmb, dpn } = cache;
  const dy0 = (y[0] - t[0]) / (std0 * std0), dy1 = (y[1] - t[1]) / (std1 * std1);
  grads.br[0] += dy0; grads.br[1] += dy1;
  const R = readoutKC.length + nMBON;
  dkc.fill(0); dmb.fill(0);
  for (let r = 0; r < R; r++) {
    const isKC = r < readoutKC.length;
    const v = isKC ? kc[readoutKC[r]] : mb[r - readoutKC.length];
    grads.Wr[r * 2] += dy0 * v; grads.Wr[r * 2 + 1] += dy1 * v;
    const dv = dy0 * Wr[r * 2] + dy1 * Wr[r * 2 + 1];
    if (isKC) dkc[readoutKC[r]] += dv; else dmb[r - readoutKC.length] += dv;
  }
  for (let m = 0; m < nMBON; m++) dmb[m] *= (1 - mb[m] * mb[m]) * 2; // d tanh(2u)
  for (let i = 0; i < G.e2.n; i++) dkc[G.e2.a[i]] += dmb[G.e2.b[i]] * G.e2.w[i];
  dpn.fill(0);
  for (let k = 0; k < nKC; k++) {
    if (kcin[k] <= theta[k]) { dkc[k] = 0; continue; }
    dkc[k] *= 3; grads.theta[k] -= dkc[k];
  }
  for (let i = 0; i < G.e1.n; i++) { const d = dkc[G.e1.b[i]]; if (d !== 0) dpn[G.e1.a[i]] += d * G.e1.w[i]; }
  for (let i = 0; i < nPN; i++) {
    if (Math.abs(drive[i]) >= 30) continue;
    const dd = dpn[i] * pn[i] * (1 - pn[i]);
    if (dd === 0) continue;
    grads.b[i] += dd; const off = i * D;
    for (let j = 0; j < D; j++) grads.W[off + j] += dd * x[j];
  }
}

function zeros(P) { return { W: new Float64Array(P.W.length), b: new Float64Array(P.b.length), theta: new Float64Array(P.theta.length), Wr: new Float64Array(P.Wr.length), br: new Float64Array(2) }; }
function adam(P, grads, state, lr, step, scale) {
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  for (const key of ['W', 'b', 'theta', 'Wr', 'br']) {
    const p = P[key], g = grads[key];
    if (!state[key]) state[key] = { m: new Float64Array(p.length), v: new Float64Array(p.length) };
    const { m, v } = state[key];
    const decay = key === 'W' || key === 'Wr' ? WD : 0;
    for (let i = 0; i < p.length; i++) {
      const gi = g[i] * scale + decay * p[i];
      m[i] = b1 * m[i] + (1 - b1) * gi; v[i] = b2 * v[i] + (1 - b2) * gi * gi;
      const mh = m[i] / (1 - b1 ** step), vh = v[i] / (1 - b2 ** step);
      p[i] -= lr * mh / (Math.sqrt(vh) + eps);
    }
  }
}

function clone(P) { return { W: P.W.slice(), b: P.b.slice(), theta: P.theta.slice(), Wr: P.Wr.slice(), br: P.br.slice(), readoutKC: P.readoutKC.slice() }; }

function trainModel(G, label) {
  const rng = mulberry32(SEED);
  const P = initParams(rng);
  const cache = makeCache();
  const state = {};
  let best = { score: -1, P: clone(P), epoch: 0 };
  let step = 0;
  const order = TR.map((_, i) => i);
  const t0 = Date.now();
  for (let epoch = 1; epoch <= EPOCHS; epoch++) {
    seededShuffle(order, rng).forEach((v, i) => { order[i] = v; });
    const lr = LR * (epoch > EPOCHS * 0.7 ? 0.3 : 1);
    for (let s = 0; s < order.length; s += BATCH) {
      const grads = zeros(P);
      const n = Math.min(BATCH, order.length - s);
      for (let k = 0; k < n; k++) {
        const r = TR[order[s + k]];
        const y = forward(P, G, r.x, cache);
        backward(P, G, r.x, y, [r.t0, r.t1], cache, grads);
      }
      adam(P, grads, state, lr, ++step, 1 / n);
    }
    const v = evaluate(VA, (r) => forward(P, G, r.x, cache));
    if (v.score > best.score) best = { score: v.score, P: clone(P), epoch };
    if (epoch % 10 === 0 || epoch === 1) log(`${label} epoch ${epoch}: validation ${v.score} (factor ${v.reviewFactor}, pct ${v.pctMAE}) best ${best.score} @${best.epoch} · ${Math.round((Date.now() - t0) / 1000)}s`);
    if (epoch - best.epoch >= 25) { log(`${label}: no improvement for 25 epochs, stopping`); break; }
  }
  return best;
}

// ---------------------------------------------------------------- ridge baseline on the same features
function ridge(alpha) {
  const n = D + 1;
  const A = Array.from({ length: n }, () => new Float64Array(n));
  const B = [new Float64Array(n), new Float64Array(n)];
  for (const r of TR) {
    const x = [...r.x, 1];
    for (let i = 0; i < n; i++) { const xi = x[i]; if (!xi) continue; for (let j = 0; j < n; j++) A[i][j] += xi * x[j]; B[0][i] += xi * r.t0; B[1][i] += xi * r.t1; }
  }
  for (let i = 0; i < D; i++) A[i][i] += alpha;
  const solve = (bv) => {
    const M = A.map((row, i) => [...row, bv[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c] || 1e-12;
      for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / d; if (!f) continue; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((row, i) => row[n] / (row[i] || 1e-12));
  };
  const w0 = solve(B[0]), w1 = solve(B[1]);
  return (r) => { let y0 = w0[D], y1 = w1[D]; for (let j = 0; j < D; j++) { y0 += w0[j] * r.x[j]; y1 += w1[j] * r.x[j]; } return [y0, y1]; };
}

// ---------------------------------------------------------------- run
const G = buildGraph(base.edges1, base.edges2);
const fly = trainModel(G, 'fly');
const cache = makeCache();
const flyFn = (r) => forward(fly.P, G, r.x, cache);
let bestRidge = null;
for (const alpha of [0.3, 1, 3, 10, 30, 100]) {
  const fn = ridge(alpha); const v = evaluate(VA, fn);
  if (!bestRidge || v.score > bestRidge.val.score) bestRidge = { alpha, fn, val: v };
}
const constantFn = () => [mean0, mean1];
const results = { fly: evaluate(TE, flyFn), ordinary: evaluate(TE, bestRidge.fn), constant: evaluate(TE, constantFn) };
const validation = { fly: evaluate(VA, flyFn), ordinary: bestRidge.val, constant: evaluate(VA, constantFn) };
log('TEST  fly', JSON.stringify(results.fly), '| ordinary', JSON.stringify(results.ordinary), '| constant', JSON.stringify(results.constant));

let shuffled = null;
if (args.ablation) {
  // same graph size, KC targets of the PN->KC edges permuted: does the real wiring matter?
  const rng = mulberry32(SEED + 7);
  const targets = seededShuffle(base.edges1.map((e) => e[1]), rng);
  const GS = buildGraph(base.edges1.map((e, i) => [e[0], targets[i], e[2]]), base.edges2);
  const sh = trainModel(GS, 'shuffled');
  shuffled = evaluate(TE, (r) => forward(sh.P, GS, r.x, cache));
  results.shuffled = shuffled;
  log('TEST  shuffled', JSON.stringify(shuffled));
}

// paired bootstrap of fly - ordinary on the test games
const rngB = mulberry32(SEED + 1);
const diffs = TE.map((r) => {
  const a = toGuess(...flyFn(r)), b = toGuess(...bestRidge.fn(r)); const ap = Math.round((r.g.pos / r.g.reviews) * 100);
  return (roundScore(a.reviews, r.g.reviews) + bonusScore(a.pct, ap)) - (roundScore(b.reviews, r.g.reviews) + bonusScore(b.pct, ap));
});
const boots = [];
for (let i = 0; i < 1000; i++) { let s = 0; for (let k = 0; k < diffs.length; k++) s += diffs[Math.floor(rngB() * diffs.length)]; boots.push(s / diffs.length); }
boots.sort((a, b) => a - b);
const ci = [+boots[25].toFixed(2), +boots[974].toFixed(2)];
log(`fly - ordinary on test: mean ${(diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1)}, 95% CI [${ci}]`);

if (args.dry) { log('dry run, nothing written'); process.exit(0); }

// ---------------------------------------------------------------- write model.json + metrics.json
const P = fly.P;
const projection = Array.from({ length: nPN }, (_, i) => {
  const indices = [], weights = [];
  for (let j = 0; j < D; j++) { const w = P.W[i * D + j]; if (Math.abs(w) > 1e-4) { indices.push(j); weights.push(+w.toFixed(5)); } }
  return { indices, weights, bias: +P.b[i].toFixed(5) };
});
const model = {
  ...base,
  version: (base.version || 1) + 1,
  kind: 'flywire-mushroom-body-trained-projection',
  projection,
  thresholds: Array.from(P.theta, (v) => +v.toFixed(5)),
  readoutKC: P.readoutKC,
  readout: { mean: new Array(P.readoutKC.length + nMBON).fill(0), std: new Array(P.readoutKC.length + nMBON).fill(1), weights: Array.from({ length: P.readoutKC.length + nMBON }, (_, r) => [+P.Wr[r * 2].toFixed(6), +P.Wr[r * 2 + 1].toFixed(6)]), bias: [+P.br[0].toFixed(6), +P.br[1].toFixed(6)], alpha: null },
  training: { method: 'adam on the input projection, KC thresholds and readout; connectome edges fixed', epochs: fly.epoch, lr: LR, batch: BATCH, weightDecay: WD, seed: SEED, readout: READOUT, trained: new Date().toISOString().slice(0, 10) },
};
fs.writeFileSync(path.join(FLY, 'model.json'), JSON.stringify(model));
// parity: the browser inference must reproduce the trainer's forward pass
const check = TE.slice(0, 20).map((r) => { const a = toGuess(...flyFn(r)); const b = predict(r.g, model); return Math.abs(Math.log10(a.reviews + 1) - Math.log10(b.reviews + 1)) < 0.01 && Math.abs(a.pct - b.pct) <= 1; });
log(`inference parity on 20 test games: ${check.filter(Boolean).length}/20`);

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const prev = JSON.parse(fs.readFileSync(path.join(FLY, 'metrics.json'), 'utf8'));
const metrics = {
  ...prev,
  created: new Date().toISOString().slice(0, 10),
  seed: SEED,
  split: { train: TR.length, validation: VA.length, test: TE.length },
  featureCount: D,
  method: model.training.method,
  results: { ...prev.results, ...results },
  validation,
  bestEpoch: fly.epoch,
  flyVsOrdinary95CI: ci,
  sha256: { ...(prev.sha256 || {}), 'games.json': sha(gamesFile), 'model.json': sha(path.join(FLY, 'model.json')) },
};
delete metrics.curve; delete metrics.selectedAlpha; delete metrics.seconds;
fs.writeFileSync(path.join(FLY, 'metrics.json'), JSON.stringify(metrics));
log('written public/fly/model.json and metrics.json');

if (args.fixtures) {
  const fx = TE.slice(0, 8).map((r) => { const p = predict(r.g, model); return { id: r.g.id, raw: p.raw, reviews: p.reviews, pct: p.pct, pn: p.state.slice(0, 5), kc: p.state.slice(nPN, nPN + 5) }; });
  fs.writeFileSync(path.join(ROOT, 'scripts', 'fly', 'fixtures.json'), JSON.stringify(fx));
  log('fixtures regenerated');
}
