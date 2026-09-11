// Builds the brain point cloud for the fly mode from the FlyWire tables (CC BY-NC 4.0):
//   public/fly/brain.bin      every FlyWire neuron as one quantized point (uint16 xyz) + neuropil group index
//   public/fly/pathway.json   the circuit's own 2415 neurons (PN / KC / MBON) in the same normalized space
// Inputs (scripts/fly/cache/, downloaded from github.com/snedea/flybrain/tree/main/data):
//   coordinates.csv.gz  root_id, position "[x y z]" (nm), supervoxel_id   (several rows per neuron)
//   neurons.csv.gz      root_id, group (neuropil), nt_type, ...
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { mulberry32 } from '../../src/lib/rng.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE = path.join(ROOT, 'scripts', 'fly', 'cache');
const FLY = path.join(ROOT, 'public', 'fly');
const readGz = (f) => zlib.gunzipSync(fs.readFileSync(path.join(CACHE, f))).toString('utf8');

// one representative point per neuron: the first listed coordinate
const pos = new Map();
for (const line of readGz('coordinates.csv.gz').split('\n').slice(1)) {
  if (!line) continue;
  const id = line.slice(0, line.indexOf(','));
  if (pos.has(id)) continue;
  const m = /\[\s*(-?\d+)\s+(-?\d+)\s+(-?\d+)\s*\]/.exec(line);
  if (m) pos.set(id, [Number(m[1]), Number(m[2]), Number(m[3])]);
}
const group = new Map();
for (const line of readGz('neurons.csv.gz').split('\n').slice(1)) {
  if (!line) continue;
  const [id, g] = line.split(',');
  group.set(id, g || '');
}
console.log(`coordinates for ${pos.size} neurons, groups for ${group.size}`);

// bounding box over everything, then a cubic normalization keeps proportions
const ids = [...pos.keys()];
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (const id of ids) { const p = pos.get(id); for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; } }
const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
const norm = (p) => p.map((v, k) => (v - min[k]) / span); // 0..1, same scale on every axis
const q = (v) => Math.max(0, Math.min(65535, Math.round(v * 65535)));

const groupNames = [...new Set(ids.map((id) => group.get(id) || ''))].sort();
const groupIndex = new Map(groupNames.map((g, i) => [g, i]));
const positions = new Uint16Array(ids.length * 3);
const groups = new Uint8Array(ids.length);
ids.forEach((id, i) => { const n = norm(pos.get(id)); positions[i * 3] = q(n[0]); positions[i * 3 + 1] = q(n[1]); positions[i * 3 + 2] = q(n[2]); groups[i] = Math.min(255, groupIndex.get(group.get(id) || '')); });
const header = Buffer.from(JSON.stringify({ count: ids.length, groups: groupNames, bbox: { min, max, span }, source: 'FlyWire FAFB v783 via github.com/snedea/flybrain (CC BY-NC 4.0)' }), 'utf8');
const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32LE(header.length, 0);
fs.mkdirSync(FLY, { recursive: true });
fs.writeFileSync(path.join(FLY, 'brain.bin'), Buffer.concat([lenBuf, header, Buffer.from(positions.buffer), Buffer.from(groups.buffer)]));

// the circuit's neurons, by layer, in the same space; a missing coordinate gets the layer centroid + jitter
const model = JSON.parse(fs.readFileSync(path.join(FLY, 'model.json'), 'utf8'));
const rng = mulberry32(783);
const pathway = { missing: {}, groups: {} };
for (const layer of ['pn', 'kc', 'mbon']) {
  const list = model.ids[layer];
  const found = list.map((id) => (pos.has(id) ? norm(pos.get(id)) : null));
  const known = found.filter(Boolean);
  const c = [0, 1, 2].map((k) => known.reduce((s, p) => s + p[k], 0) / Math.max(1, known.length));
  const r = 0.01;
  pathway[layer] = found.map((p) => (p || c.map((v) => v + (rng() - 0.5) * r)).map((v) => +v.toFixed(4)));
  pathway.missing[layer] = found.length - known.length;
  pathway.groups[layer] = [...new Set(list.map((id) => group.get(id)).filter(Boolean))];
}
fs.writeFileSync(path.join(FLY, 'pathway.json'), JSON.stringify(pathway));
const size = (f) => (fs.statSync(path.join(FLY, f)).size / 1024).toFixed(0) + ' KB';
console.log(`brain.bin ${size('brain.bin')} (${ids.length} points, ${groupNames.length} groups), pathway.json ${size('pathway.json')}, missing coordinates:`, pathway.missing, 'neuropils:', pathway.groups);
