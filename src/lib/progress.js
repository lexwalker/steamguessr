// Progression: daily numbering and themes, grades, XP and Steam-flavoured ranks, calibration
// (how far off the player usually is), achievements, and a tiny toast bus for unlock messages.
import { POOLS } from './scoring.js';
import { t } from './i18n.js';

export const DAILY_EPOCH = '2026-09-07';
// Pool of the daily by weekday (0 = Sunday): some days are themed, the rest are the mix.
export const DAILY_THEMES = ['mix', 'horror', 'mix', 'indie', 'strategy', 'hits', 'mix'];
// Weekly challenge: a blitz — ten rounds, ten seconds each, one attempt per week.
export const WEEKLY = { rounds: 10, timer: 10, pool: 'mix' };
export const GRADES = [['S', 27000], ['A', 22000], ['B', 16000], ['C', 10000]];
export const HISTORY_MAX = 200;
export const CALIB_WINDOW = 20;
export const CALIB_MIN = 10;

function parse(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(a, b) {
  return Math.round((parse(b) - parse(a)) / 86400000);
}

export function shiftDay(key, delta) {
  const dt = parse(key);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function dailyNumber(key) {
  return daysBetween(DAILY_EPOCH, key) + 1;
}

export function dailyPool(key) {
  return DAILY_THEMES[parse(key).getDay()] || 'mix';
}

export function dailyGrade(score) {
  for (const [g, min] of GRADES) if (score >= min) return g;
  return 'D';
}

// ISO week key, e.g. 2026-W37.
export function weekKey(key) {
  const d = parse(key);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day + 3); // Thursday of this week decides the year
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function msToMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(0, next - now);
}

// ------------------------------------------------------------------ XP and levels

export function xpFor(kind, score, streak = 0) {
  const base = score / 100;
  if (kind === 'daily') return Math.round(base * 2 * (1 + Math.min(0.5, 0.1 * Math.floor(streak / 7))));
  if (kind === 'weekly') return Math.round(base * 2);
  if (kind === 'hilo') return score * 5; // score = streak length
  if (kind === 'mp') return Math.round(base) + (streak ? 100 : 0); // streak = won
  return Math.round(base);
}

export function xpForLevel(level) {
  return 200 * (level - 1) * level;
}

export function levelFromXp(xp) {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + Math.max(0, xp) / 50)) / 2));
}

// Ranks borrow Steam's review summaries.
export function rankKey(level) {
  if (level >= 25) return 'score.9';
  if (level >= 20) return 'score.8';
  if (level >= 15) return 'score.7';
  if (level >= 10) return 'score.6';
  if (level >= 5) return 'score.5';
  return 'score.none';
}

export function levelInfo(xp) {
  const level = levelFromXp(xp);
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, xp, rank: t(rankKey(level)), into: xp - cur, span: next - cur, toNext: next - xp, next };
}

// ------------------------------------------------------------------ calibration

export function logError(guess, actual) {
  return Math.abs(Math.log10((guess + 1) / (actual + 1)));
}

const GENRE_POOLS = POOLS.filter((p) => p.byTag);

export function recordRound(stats, { guess, game, pool, mode, date }) {
  if (!game || typeof guess !== 'number') return;
  const genres = GENRE_POOLS.filter((p) => p.test(game)).map((p) => p.id);
  stats.history.push({ e: Math.round(logError(guess, game.reviews) * 1000) / 1000, p: pool, g: genres, m: mode, d: date });
  if (stats.history.length > HISTORY_MAX) stats.history.splice(0, stats.history.length - HISTORY_MAX);
}

function ratioOf(entries) {
  const mean = entries.reduce((s, h) => s + h.e, 0) / entries.length;
  return Math.pow(10, mean);
}

export function calibTier(ratio) {
  if (ratio > 10) return 1;
  if (ratio > 5) return 2;
  if (ratio > 3) return 3;
  if (ratio > 2) return 4;
  return 5;
}

export function calibration(stats) {
  const h = stats.history.slice(-CALIB_WINDOW);
  if (h.length < CALIB_MIN) return { rounds: h.length, need: CALIB_MIN - h.length, ratio: null, tier: 0 };
  const ratio = ratioOf(h);
  return { rounds: h.length, need: 0, ratio, tier: calibTier(ratio) };
}

// Best and weakest group (by pool `p` or by genre list `g`) among groups with at least 5 rounds.
export function breakdown(stats, field, min = 5) {
  const groups = {};
  for (const h of stats.history) {
    const keys = field === 'g' ? h.g || [] : [h.p];
    for (const k of keys) {
      if (!k) continue;
      (groups[k] = groups[k] || []).push(h);
    }
  }
  const rows = Object.entries(groups).filter(([, v]) => v.length >= min).map(([id, v]) => ({ id, rounds: v.length, ratio: ratioOf(v) })).sort((a, b) => a.ratio - b.ratio);
  return { best: rows[0] || null, worst: rows.length > 1 ? rows[rows.length - 1] : null, rows };
}

// ------------------------------------------------------------------ achievements

export const ACHIEVEMENTS = ['bullseye', 'five_green', 'rating_exact', 'streak3', 'streak7', 'streak30', 'streak100', 'hilo20', 'mp_wins3', 'daily_s', 'weekly_done', 'sharp', 'fly_win'];
export const ACH_ICON = { bullseye: '🎯', five_green: '🟩', rating_exact: '💯', streak3: '🔥', streak7: '🔥', streak30: '🔥', streak100: '🔥', hilo20: '⚖️', mp_wins3: '👑', daily_s: 'S', weekly_done: '🏆', sharp: '🧠', fly_win: '🪰' };

export function unlock(stats, id, date) {
  if (stats.ach[id]) return false;
  stats.ach[id] = date;
  return true;
}

export function checkStreak(stats, date) {
  const out = [];
  const n = stats.streak.count;
  for (const [id, need] of [['streak3', 3], ['streak7', 7], ['streak30', 30], ['streak100', 100]]) if (n >= need && unlock(stats, id, date)) out.push(id);
  return out;
}

export function checkCalibration(stats, date) {
  const c = calibration(stats);
  return c.rounds >= CALIB_WINDOW && c.ratio < 2 && unlock(stats, 'sharp', date) ? ['sharp'] : [];
}

// After a finished classic / daily / weekly game.
export function checkGame(stats, { results, games, daily, weekly, grade, date }) {
  const out = [];
  const byId = new Map(games.map((g) => [g.id, g]));
  const hit = results.some((r) => { const g = byId.get(r.id); return g && Math.pow(10, logError(r.guess, g.reviews)) <= 1.05; });
  if (hit && unlock(stats, 'bullseye', date)) out.push('bullseye');
  if (results.length >= 5 && results.every((r) => (r.main ?? r.score) >= 4000) && unlock(stats, 'five_green', date)) out.push('five_green');
  if (results.some((r) => r.bonus >= 1000) && unlock(stats, 'rating_exact', date)) out.push('rating_exact');
  if (daily && grade === 'S' && unlock(stats, 'daily_s', date)) out.push('daily_s');
  if (weekly && unlock(stats, 'weekly_done', date)) out.push('weekly_done');
  return out;
}

// ------------------------------------------------------------------ toasts

const toastListeners = new Set();
export function onToast(fn) {
  toastListeners.add(fn);
  return () => toastListeners.delete(fn);
}
export function toast(msg) {
  toastListeners.forEach((fn) => fn(msg));
}
