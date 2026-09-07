import { rngFromSeed, seededShuffle } from './rng.js';
import { POOLS } from './scoring.js';

// The dataset stores standard Steam CDN images in short form (see scripts/build-dataset.mjs).
const CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';
export const headerUrl = (id) => `${CDN}/${id}/header.jpg`;
export const shotUrl = (id, s) => (/^[0-9a-f]{20,}$/.test(s) ? `${CDN}/${id}/ss_${s}.600x338.jpg` : s);

function normalize(g) {
  return {
    ...g,
    img: g.img || headerUrl(g.id),
    shots: (g.shots || []).map((s) => shotUrl(g.id, s)),
    tags: g.tags || [],
    genres: g.genres || [],
    dev: g.dev || [],
    pub: g.pub || [],
    platforms: g.platforms || [],
  };
}

export async function loadGames() {
  const r = await fetch(`${import.meta.env.BASE_URL}data/games.json`, { cache: 'no-cache' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const games = (j.games || []).filter((g) => g && g.name && typeof g.reviews === 'number').map(normalize);
  return { version: j.version || '', games };
}

export function poolGames(games, poolId) {
  const p = POOLS.find((x) => x.id === poolId) || POOLS[0];
  return games.filter(p.test);
}

export function pickGames(games, poolId, seed, n) {
  let list = poolGames(games, poolId);
  if (list.length < n) list = games;
  return seededShuffle(list, rngFromSeed(seed)).slice(0, n);
}

// Higher/Lower deck: skip near-zero counts so the comparison is not a coin flip.
export function hiloDeck(games, seed, n = 80) {
  const list = games.filter((g) => g.reviews >= 20);
  return seededShuffle(list.length >= 2 ? list : games, rngFromSeed(seed)).slice(0, n);
}

export function steamUrl(g) {
  return `https://store.steampowered.com/app/${g.id}/`;
}
