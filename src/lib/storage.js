const KEY = 'steamguessr';
const EMPTY = { classicBest: 0, classicGames: 0, hiloBest: 0, daily: {}, streak: { last: '', count: 0, best: 0 } };

export function loadStats() {
  try {
    const s = { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    s.streak = { ...EMPTY.streak, ...(s.streak || {}) };
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
  return s;
}

function shiftDay(dateKey, delta) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// Consecutive days with a finished daily. Called once when today's daily is completed.
export function bumpStreak(stats, dateKey) {
  const st = stats.streak;
  if (st.last === dateKey) return st;
  st.count = st.last === shiftDay(dateKey, -1) ? st.count + 1 : 1;
  st.last = dateKey;
  if (st.count > st.best) st.best = st.count;
  return st;
}

// The streak as it should be shown today: broken if yesterday's daily was missed.
export function currentStreak(stats, todayKey) {
  const st = stats.streak;
  if (st.last === todayKey || st.last === shiftDay(todayKey, -1)) return st.count;
  return 0;
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
