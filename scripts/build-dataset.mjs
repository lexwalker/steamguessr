#!/usr/bin/env node
/*
  SteamGuessr dataset builder.

  Collects a pool of games (SteamSpy top pages by owners + random games from the
  store search), then for each game fetches:
    - store.steampowered.com/api/appdetails  (name, description, images, price, ...)
    - store.steampowered.com/appreviews      (exact review count, all languages)
    - steamspy.com appdetails                (tags, owners estimate)
  and writes public/data/games.json.

  Resumable: every app is cached in scripts/cache/apps/<id>.json, so re-running
  only fetches what is missing. games.json is rewritten every 20 apps.

  Usage:
    node scripts/build-dataset.mjs                 # default: SteamSpy pages 0-3 + 800 random tail games
    node scripts/build-dataset.mjs --limit=1500    # stop after 1500 new apps this run
    node scripts/build-dataset.mjs --spy-pages=0,1 --tail=300 --lang=english --cc=us
    node scripts/build-dataset.mjs --rebuild       # only reassemble games.json from the cache
    node scripts/build-dataset.mjs --enrich=movies # add trailer ids to apps collected without them
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, 'cache');
const APPS = path.join(CACHE, 'apps');
const OUT = path.join(ROOT, 'public', 'data', 'games.json');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const SPY_PAGES = String(args['spy-pages'] ?? '0,1,2,3').split(',').map(Number).filter((n) => !Number.isNaN(n));
const TAIL = Number(args.tail ?? 800);
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const LANG = args.lang ?? 'russian';
const CC = args.cc ?? 'us';
const CONCURRENCY = 3;
const UA = 'Mozilla/5.0 (compatible; SteamGuessr dataset builder; personal non-commercial project)';

fs.mkdirSync(APPS, { recursive: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const readJSON = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
// write via a temp file + rename so readers never see a half-written games.json
const writeJSON = (f, v) => { fs.writeFileSync(f + '.tmp', JSON.stringify(v)); fs.renameSync(f + '.tmp', f); };

async function getJSON(url, { retries = 3, backoff = 30000 } = {}) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      if (i >= retries) { log('giving up:', url, e.message); return undefined; }
      log(`retry in ${backoff * (i + 1) / 1000}s:`, url, e.message);
      await sleep(backoff * (i + 1));
    }
  }
}

// A queue that guarantees at least `gap` ms between request starts, safe for concurrent callers.
function makeQueue(gap) {
  let chain = Promise.resolve();
  let last = 0;
  return (fn) => {
    const p = chain.then(async () => {
      const wait = last + gap - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      return fn();
    });
    chain = p.catch(() => {});
    return p;
  };
}
const qStore = makeQueue(1700);    // appdetails is limited to ~200 requests per 5 minutes
const qReviews = makeQueue(1000);
const qSpy = makeQueue(1100);      // SteamSpy asks for 1 request per second

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ------------------------------------------------------------------ pool

async function buildPool() {
  const poolFile = path.join(CACHE, 'pool.json');
  const cached = readJSON(poolFile);
  if (cached) return cached;

  const tiers = new Map(); // appid -> 'top' | 'tail'
  for (let i = 0; i < SPY_PAGES.length; i++) {
    const p = SPY_PAGES[i];
    const f = path.join(CACHE, `spy-page-${p}.json`);
    let data = readJSON(f);
    if (!data) {
      log('SteamSpy: page', p);
      data = await getJSON(`https://steamspy.com/api.php?request=all&page=${p}`);
      if (!data || !Object.keys(data).length) {
        log('SteamSpy: empty page', p, '(rate limited?) waiting 65s');
        await sleep(65000);
        data = await getJSON(`https://steamspy.com/api.php?request=all&page=${p}`);
      }
      if (data && Object.keys(data).length) {
        writeJSON(f, data);
        if (i < SPY_PAGES.length - 1) { log('SteamSpy: pausing 61s (1 "all" request per minute)'); await sleep(61000); }
      }
    }
    for (const k of Object.keys(data || {})) tiers.set(Number(k), 'top');
  }

  const tailFile = path.join(CACHE, 'tail.json');
  let tail = readJSON(tailFile);
  if (!tail && TAIL > 0) {
    tail = [];
    const search = (start, count) =>
      `https://store.steampowered.com/search/results/?query=&infinite=1&category1=998&l=english&start=${start}&count=${count}`;
    const first = await getJSON(search(0, 1));
    const total = first?.total_count || 150000;
    const pages = Math.ceil(TAIL / 50);
    for (let i = 0; i < pages; i++) {
      const start = Math.floor(Math.random() * Math.max(1, total - 50));
      const j = await getJSON(search(start, 50));
      for (const m of (j?.results_html || '').matchAll(/data-ds-appid="(\d+)"/g)) tail.push(Number(m[1]));
      log(`store search: tail page ${i + 1}/${pages}, ${tail.length} ids`);
      await sleep(1200);
    }
    writeJSON(tailFile, tail);
  }
  for (const id of tail || []) if (!tiers.has(id)) tiers.set(id, 'tail');

  const pool = shuffle([...tiers].map(([id, tier]) => ({ id, tier })));
  writeJSON(poolFile, pool);
  log('pool:', pool.length, 'apps');
  return pool;
}

// ------------------------------------------------------------- per app

const stripHtml = (s) => String(s || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

function compose(id, tier, data, q, spy) {
  const desc = stripHtml(data.short_description);
  const platforms = ['windows', 'mac', 'linux'].filter((p) => data.platforms && data.platforms[p]);
  const tags = Object.entries((spy && spy.tags) || {}).sort((a, b) => b[1] - a[1]).slice(0, 7).map((t) => t[0]);
  const year = ((data.release_date && data.release_date.date) || '').match(/\d{4}/);
  const m0 = (data.movies || []).find((m) => m.highlight) || (data.movies || [])[0];
  return {
    id,
    tier,
    name: data.name,
    desc: desc.length > 320 ? desc.slice(0, 317).replace(/\s+\S*$/, '') + '…' : desc,
    img: data.header_image,
    shots: (data.screenshots || []).slice(0, 4).map((s) => s.path_thumbnail),
    movie: m0 ? m0.id : null,
    moviesChecked: true,
    tags,
    genres: (data.genres || []).map((g) => g.description).slice(0, 4),
    year: year ? Number(year[0]) : null,
    date: (data.release_date && data.release_date.date) || '',
    price: data.is_free ? 0 : (data.price_overview ? data.price_overview.final / 100 : null),
    priceText: data.is_free ? 'free' : (data.price_overview ? data.price_overview.final_formatted : null),
    dev: (data.developers || []).slice(0, 2),
    pub: (data.publishers || []).slice(0, 2),
    platforms,
    reviews: q.total_reviews | 0,
    pos: q.total_positive | 0,
    scoreDesc: q.review_score_desc || '',
    meta: (data.metacritic && data.metacritic.score) || null,
    dlc: (data.dlc || []).length,
    ach: (data.achievements && data.achievements.total) || 0,
    owners: (spy && spy.owners) || null,
    ccu: (spy && spy.ccu) || 0,
  };
}

async function processApp({ id, tier }) {
  const f = path.join(APPS, id + '.json');
  if (fs.existsSync(f)) return 'cached';

  const [d, r, s] = await Promise.all([
    qStore(() => getJSON(`https://store.steampowered.com/api/appdetails?appids=${id}&l=${LANG}&cc=${CC}`)),
    qReviews(() => getJSON(`https://store.steampowered.com/appreviews/${id}?json=1&language=all&num_per_page=0&l=${LANG}`)),
    qSpy(() => getJSON(`https://steamspy.com/api.php?request=appdetails&appid=${id}`)),
  ]);

  if (d === undefined || r === undefined) return 'network'; // not cached, retried on the next run
  const entry = d && d[id];
  if (!entry || !entry.success || !entry.data) { writeJSON(f, { id, skip: 'unavailable' }); return 'skip'; }
  const data = entry.data;
  if (data.type !== 'game') { writeJSON(f, { id, skip: 'type:' + data.type }); return 'skip'; }
  if (data.release_date && data.release_date.coming_soon) { writeJSON(f, { id, skip: 'coming soon' }); return 'skip'; }
  if (!data.header_image) { writeJSON(f, { id, skip: 'no image' }); return 'skip'; }
  const q = r && r.query_summary;
  if (!q) return 'network';
  if (!q.total_reviews) { writeJSON(f, { id, skip: 'no reviews' }); return 'skip'; }

  writeJSON(f, compose(id, tier, data, q, s || null));
  return 'ok';
}

// Standard CDN image URLs are replaced by short forms the site rebuilds from the app id
// (src/lib/data.js); unusual URLs stay as they are.
const HEADER_RE = /^https:\/\/shared\.(?:akamai|fastly)\.steamstatic\.com\/store_item_assets\/steam\/apps\/(\d+)\/header\.jpg(?:\?.*)?$/;
const SHOT_RE = /^https:\/\/shared\.(?:akamai|fastly)\.steamstatic\.com\/store_item_assets\/steam\/apps\/(\d+)\/ss_([0-9a-f]+)\.600x338\.jpg(?:\?.*)?$/;

function compact(g) {
  const out = { ...g };
  delete out.ccu;
  delete out.moviesChecked;
  if (typeof out.movie !== 'number') delete out.movie;
  const hm = HEADER_RE.exec(g.img || '');
  if (hm && hm[1] === String(g.id)) delete out.img;
  out.shots = (g.shots || []).map((s) => {
    const m = SHOT_RE.exec(s);
    return m && m[1] === String(g.id) ? m[2] : s;
  });
  return out;
}

function assemble() {
  const games = [];
  let skipped = 0;
  for (const f of fs.readdirSync(APPS)) {
    if (!f.endsWith('.json')) continue;
    const g = readJSON(path.join(APPS, f));
    if (!g || g.skip) { skipped++; continue; }
    games.push(compact(g));
  }
  games.sort((a, b) => b.reviews - a.reviews);
  writeJSON(OUT, { version: new Date().toISOString().slice(0, 10), lang: LANG, count: games.length, games });
  return { games: games.length, skipped };
}

// ------------------------------------------------------------------ main

// Fill in trailer ids for cached apps collected before movies were stored (popular games first).
async function enrichMovies() {
  const todo = [];
  for (const f of fs.readdirSync(APPS)) {
    if (!f.endsWith('.json')) continue;
    const g = readJSON(path.join(APPS, f));
    if (g && !g.skip && !g.moviesChecked) todo.push(g);
  }
  todo.sort((a, b) => b.reviews - a.reviews);
  const total = Math.min(todo.length, LIMIT);
  log(`movies: ${todo.length} apps without trailer info, checking ${total}`);
  let done = 0;
  const stats = { ok: 0, none: 0, network: 0 };
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (todo.length && done < LIMIT) {
      const g = todo.shift();
      const d = await qStore(() => getJSON(`https://store.steampowered.com/api/appdetails?appids=${g.id}&filters=movies`));
      if (d === undefined) { stats.network++; continue; }
      const entry = d && d[g.id];
      const movies = (entry && entry.success && entry.data && entry.data.movies) || [];
      const m = movies.find((x) => x.highlight) || movies[0];
      g.movie = m ? m.id : null;
      g.moviesChecked = true;
      writeJSON(path.join(APPS, g.id + '.json'), g);
      stats[m ? 'ok' : 'none']++;
      done++;
      if (done % 50 === 0) { assemble(); log(`movies ${done}/${total} (ok ${stats.ok}, none ${stats.none}, network ${stats.network})`); }
    }
  });
  await Promise.all(workers);
  const r = assemble();
  log(`done. movies: ok ${stats.ok}, none ${stats.none}, network ${stats.network}; games.json: ${r.games} games`);
}

async function main() {
  if (args.enrich === 'movies') {
    await enrichMovies();
    return;
  }
  if (args.rebuild) {
    const r = assemble();
    log(`games.json rebuilt: ${r.games} games (${r.skipped} skipped entries)`);
    return;
  }
  const pool = await buildPool();
  const todo = pool.filter(({ id }) => !fs.existsSync(path.join(APPS, id + '.json')));
  log(`pool ${pool.length}, already cached ${pool.length - todo.length}, to fetch ${Math.min(todo.length, LIMIT)}`);

  let index = 0;
  let done = 0;
  const stats = { ok: 0, skip: 0, network: 0 };
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (index < todo.length && index < LIMIT) {
      const item = todo[index++];
      const res = await processApp(item);
      stats[res] = (stats[res] || 0) + 1;
      done++;
      if (done % 20 === 0) {
        const r = assemble();
        log(`progress ${done}/${Math.min(todo.length, LIMIT)} (ok ${stats.ok}, skip ${stats.skip}, network ${stats.network}) -> games.json: ${r.games} games`);
      }
    }
  });
  await Promise.all(workers);
  const r = assemble();
  log(`done. games.json: ${r.games} games, ${r.skipped} skipped, this run: ok ${stats.ok}, skip ${stats.skip}, network ${stats.network}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
