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

export function fmt(n) {
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function ratioText(guess, actual) {
  const g = guess + 1;
  const a = actual + 1;
  const r = g > a ? g / a : a / g;
  if (r < 1.05) return 'почти в точку';
  const dir = g > a ? 'больше' : 'меньше';
  if (r < 10) return `в ${r.toFixed(1).replace('.', ',')} раза ${dir} правды`;
  const n = Math.round(r);
  const m10 = n % 10;
  const m100 = n % 100;
  const word = m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14) ? 'раза' : 'раз';
  return `в ${fmt(n)} ${word} ${dir} правды`;
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

// Steam's rating label for a share of positive reviews (count thresholds ignored).
export function ratingTier(pct) {
  if (pct >= 95) return { name: 'Крайне положительные', tone: 'positive' };
  if (pct >= 80) return { name: 'Очень положительные', tone: 'positive' };
  if (pct >= 70) return { name: 'В основном положительные', tone: 'positive' };
  if (pct >= 40) return { name: 'Смешанные', tone: 'mixed' };
  if (pct >= 20) return { name: 'В основном отрицательные', tone: 'negative' };
  return { name: 'Крайне отрицательные', tone: 'negative' };
}

export const TONE_COLORS = { positive: '#66c0f4', mixed: '#b9a074', negative: '#a34c25' };

export function reviewsWord(n) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return 'отзывов';
  if (m10 === 1) return 'отзыв';
  if (m10 >= 2 && m10 <= 4) return 'отзыва';
  return 'отзывов';
}

export function daysWord(n) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return 'дней';
  if (m10 === 1) return 'день';
  if (m10 >= 2 && m10 <= 4) return 'дня';
  return 'дней';
}

const BASE_POOLS = [
  { id: 'mix', label: 'Микс', hint: 'все игры датасета', test: () => true },
  { id: 'hits', label: 'Хиты', hint: 'от 20 000 отзывов', test: (g) => g.reviews >= 20000 },
  { id: 'indie', label: 'Середина', hint: 'от 300 до 20 000 отзывов', test: (g) => g.reviews >= 300 && g.reviews < 20000 },
  { id: 'hard', label: 'Хардкор', hint: 'меньше 300 отзывов', test: (g) => g.reviews < 300 },
];

const TAG_POOLS = [
  { id: 'horror', label: 'Хорроры', tags: ['Horror', 'Survival Horror', 'Psychological Horror'] },
  { id: 'strategy', label: 'Стратегии', tags: ['Strategy', 'RTS', 'Turn-Based Strategy', 'Grand Strategy', '4X', 'Tower Defense'] },
  { id: 'coop', label: 'Кооп', tags: ['Co-op', 'Online Co-Op', 'Local Co-Op'] },
  { id: 'rpg', label: 'RPG', tags: ['RPG', 'Action RPG', 'JRPG', 'CRPG'] },
  { id: 'shooter', label: 'Шутеры', tags: ['FPS', 'Shooter', 'Third-Person Shooter', 'Hero Shooter', 'Arena Shooter'] },
  { id: 'sim', label: 'Симуляторы', tags: ['Simulation', 'Life Sim', 'Farming Sim', 'Management', 'City Builder', 'Building'] },
].map((p) => {
  const set = new Set(p.tags);
  return { ...p, hint: 'по тегам Steam: ' + p.tags.slice(0, 3).join(', '), test: (g) => g.tags.some((t) => set.has(t)), byTag: true };
});

export const POOLS = [...BASE_POOLS, ...TAG_POOLS];

export function poolLabel(id) {
  const p = POOLS.find((x) => x.id === id);
  return p ? p.label : id;
}

export const HINTS = [
  { id: 'tags', label: 'Теги и жанры', cost: 500 },
  { id: 'details', label: 'Год, цена, разработчик', cost: 750 },
  { id: 'press', label: 'Metacritic, DLC, достижения', cost: 1000 },
];

export function hintCost(ids) {
  return HINTS.filter((h) => ids.includes(h.id)).reduce((s, h) => s + h.cost, 0);
}

// One round, fully scored: the review-count guess plus the positive-share bonus.
export function scoreRound(game, guess, pct, maxScore) {
  const main = roundScore(guess, game.reviews, maxScore);
  const bonus = game.reviews > 0 && typeof pct === 'number' ? bonusScore(pct, positivePct(game)) : 0;
  return { main, bonus, score: main + bonus };
}
