export const MAX_ROUND = 5000;
export const ROUNDS = 5;
export const SLIDER_MAX = 5_000_000;
export const LOG_MAX = Math.log10(SLIDER_MAX);
// log10 distance at which a round is worth zero (about 32x off in either direction)
export const TOLERANCE = 1.5;

export function roundScore(guess, actual, maxScore = MAX_ROUND) {
  const d = Math.abs(Math.log10(guess + 1) - Math.log10(actual + 1));
  return Math.round(maxScore * Math.max(0, 1 - d / TOLERANCE));
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
  const rs = r < 10 ? r.toFixed(1).replace('.', ',') : fmt(Math.round(r));
  return `в ${rs} раза ${g > a ? 'больше' : 'меньше'} правды`;
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

export function reviewsWord(n) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return 'отзывов';
  if (m10 === 1) return 'отзыв';
  if (m10 >= 2 && m10 <= 4) return 'отзыва';
  return 'отзывов';
}

export const POOLS = [
  { id: 'mix', label: 'Микс', hint: 'все игры датасета', test: () => true },
  { id: 'hits', label: 'Хиты', hint: 'от 20 000 отзывов', test: (g) => g.reviews >= 20000 },
  { id: 'indie', label: 'Середина', hint: 'от 300 до 20 000 отзывов', test: (g) => g.reviews >= 300 && g.reviews < 20000 },
  { id: 'hard', label: 'Хардкор', hint: 'меньше 300 отзывов', test: (g) => g.reviews < 300 },
];

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
