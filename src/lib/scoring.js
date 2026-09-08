import { t } from './i18n.js';

// Number and rating helpers live in i18n.js; re-exported so old imports keep working.
export { fmt, ratioText, ratingTier } from './i18n.js';

export const MAX_ROUND = 5000;   // for the review count
export const MAX_BONUS = 1000;   // for the share of positive reviews
export const ROUND_TOTAL = MAX_ROUND + MAX_BONUS;
export const ROUNDS = 5;
export const SLIDER_MAX = 5_000_000;
export const LOG_MAX = Math.log10(SLIDER_MAX);
// log10 distance at which a round is worth zero (about 32x off in either direction)
export const TOLERANCE = 1.5;
// percentage points off at which the bonus is worth zero
export const PCT_TOLERANCE = 30;

export function roundScore(guess, actual, maxScore = MAX_ROUND) {
  const d = Math.abs(Math.log10(guess + 1) - Math.log10(actual + 1));
  return Math.round(maxScore * Math.max(0, 1 - d / TOLERANCE));
}

export function bonusScore(guessPct, actualPct) {
  const d = Math.abs(guessPct - actualPct);
  return Math.round(MAX_BONUS * Math.max(0, 1 - d / PCT_TOLERANCE));
}

// Keeps two significant digits so the slider produces readable numbers (12 000, not 12 384).
export function niceRound(v) {
  if (v < 100) return Math.round(v);
  const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / mag) * mag;
}

export function sliderToValue(t) {
  return niceRound(Math.pow(10, t * LOG_MAX));
}

export function valueToSlider(v) {
  return Math.min(1, Math.max(0, Math.log10(Math.max(1, v)) / LOG_MAX));
}

export function scoreEmoji(s) {
  if (s >= 4000) return '🟩';
  if (s >= 2500) return '🟨';
  if (s >= 1000) return '🟧';
  return '🟥';
}

export function positivePct(g) {
  return g.reviews ? Math.round((g.pos / g.reviews) * 100) : 0;
}

export const TONE_COLORS = { positive: '#66c0f4', mixed: '#b9a074', negative: '#a34c25' };

const BASE_POOLS = [
  { id: 'mix', test: () => true },
  { id: 'hits', test: (g) => g.reviews >= 20000 },
  { id: 'indie', test: (g) => g.reviews >= 300 && g.reviews < 20000 },
  { id: 'hard', test: (g) => g.reviews < 300 },
];

const TAG_POOLS = [
  { id: 'horror', tags: ['Horror', 'Survival Horror', 'Psychological Horror'] },
  { id: 'strategy', tags: ['Strategy', 'RTS', 'Turn-Based Strategy', 'Grand Strategy', '4X', 'Tower Defense'] },
  { id: 'coop', tags: ['Co-op', 'Online Co-Op', 'Local Co-Op'] },
  { id: 'rpg', tags: ['RPG', 'Action RPG', 'JRPG', 'CRPG'] },
  { id: 'shooter', tags: ['FPS', 'Shooter', 'Third-Person Shooter', 'Hero Shooter', 'Arena Shooter'] },
  { id: 'sim', tags: ['Simulation', 'Life Sim', 'Farming Sim', 'Management', 'City Builder', 'Building'] },
].map((p) => {
  const set = new Set(p.tags);
  return { ...p, test: (g) => g.tags.some((t) => set.has(t)), byTag: true };
});

export const POOLS = [...BASE_POOLS, ...TAG_POOLS];

// Pool names and hints are interface strings (pool.<id>, poolHint.<id>).
export function poolLabel(id) {
  return POOLS.some((p) => p.id === id) ? t('pool.' + id) : id;
}

export function poolHint(p) {
  return p.byTag ? t('poolHint.tags', { tags: p.tags.slice(0, 3).join(', ') }) : t('poolHint.' + p.id);
}

// One round, fully scored: the review-count guess plus the positive-share bonus.
export function scoreRound(game, guess, pct, maxScore) {
  const main = roundScore(guess, game.reviews, maxScore);
  const bonus = game.reviews > 0 && typeof pct === 'number' ? bonusScore(pct, positivePct(game)) : 0;
  return { main, bonus, score: main + bonus };
}
