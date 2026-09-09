import { daysBetween } from './progress.js';

const KEY = 'steamguessr';
const EMPTY = {
  classicBest: 0, classicGames: 0, hiloBest: 0, hiloGames: 0, dailyPlayed: 0,
  daily: {}, weekly: {},
  streak: { last: '', count: 0, best: 0 }, freezes: 0,
  xp: 0, history: [], ach: {},
  mp: { wins: 0, games: 0, awarded: {} },
};
const listeners = new Set();

export function loadStats() {
  try {
    const s = { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    s.streak = { ...EMPTY.streak, ...(s.streak || {}) };
    s.mp = { ...EMPTY.mp, ...(s.mp || {}) };
    if (!Array.isArray(s.history)) s.history = [];
    if (!s.ach || typeof s.ach !== 'object') s.ach = {};
    if (!s.weekly || typeof s.weekly !== 'object') s.weekly = {};
    return s;
  } catch {
    return JSON.parse(JSON.stringify(EMPTY));
  }
}

export function updateStats(fn) {
  const s = loadStats();
  fn(s);
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode or storage disabled: stats simply do not persist */
  }
  listeners.forEach((l) => l(s));
  return s;
}

// Components that show level or streak in the chrome re-render on every save.
export function onStatsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function addXp(stats, n) {
  stats.xp = Math.max(0, (stats.xp || 0) + Math.max(0, Math.round(n)));
  return stats.xp;
}

// Consecutive days with a finished daily. Called once when today's daily is completed.
// Missed days can be covered by freezes (one earned per 7 days in a row, two stored at most).
export function bumpStreak(stats, dateKey) {
  const st = stats.streak;
  if (st.last === dateKey) return { streak: st, used: 0 };
  const gap = st.last ? daysBetween(st.last, dateKey) : Infinity;
  let used = 0;
  if (gap === 1) st.count += 1;
  else if (gap > 1 && gap - 1 <= (stats.freezes || 0)) { used = gap - 1; stats.freezes -= used; st.count += 1; }
  else st.count = 1;
  st.last = dateKey;
  if (st.count > st.best) st.best = st.count;
  if (st.count % 7 === 0) stats.freezes = Math.min(2, (stats.freezes || 0) + 1);
  return { streak: st, used };
}

// The streak as it should be shown today: alive if yesterday's daily was done, or if the
// missed days are covered by stored freezes (they are spent when today's daily is played).
export function currentStreak(stats, todayKey) {
  const st = stats.streak;
  if (!st.last) return 0;
  const gap = daysBetween(st.last, todayKey);
  if (gap <= 1) return st.count;
  if (gap - 1 <= (stats.freezes || 0)) return st.count;
  return 0;
}

export function streakProtected(stats, todayKey) {
  const st = stats.streak;
  if (!st.last) return false;
  const gap = daysBetween(st.last, todayKey);
  return gap > 1 && gap - 1 <= (stats.freezes || 0);
}

// The game in progress (one slot): picked game ids, answers so far, phase and the round deadline.
// A reload or "exit" mid-game resumes from the same round instead of starting over.
const RUN_KEY = 'steamguessr-run';

export function loadRun(key) {
  try {
    const r = JSON.parse(localStorage.getItem(RUN_KEY) || 'null');
    return r && r.key === key ? r : null;
  } catch {
    return null;
  }
}

export function saveRun(run) {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    /* ignore */
  }
}

export function clearRun(key) {
  try {
    const r = JSON.parse(localStorage.getItem(RUN_KEY) || 'null');
    if (r && r.key === key) localStorage.removeItem(RUN_KEY);
  } catch {
    /* ignore */
  }
}

// Daily and weekly runs are keyed by their seed only: the picked ids are stored with the run,
// so a theme change between versions still resumes the same games.
export function runKeyFor({ daily, weekly, seed, pool }) {
  if (daily) return 'daily:' + seed;
  if (weekly) return 'weekly:' + seed;
  return `classic:${seed}:${pool}`;
}

// Player identity for multiplayer: a stable id per browser plus a chosen name.
export function playerIdentity() {
  let id = '';
  let name = '';
  try {
    id = localStorage.getItem('steamguessr-pid') || '';
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      localStorage.setItem('steamguessr-pid', id);
    }
    name = localStorage.getItem('steamguessr-name') || '';
  } catch {
    id = id || Math.random().toString(36).slice(2, 10);
  }
  return { id, name };
}

export function savePlayerName(name) {
  try {
    localStorage.setItem('steamguessr-name', name);
  } catch {
    /* ignore */
  }
}
