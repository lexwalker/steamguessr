const KEY = 'steamguessr';
const EMPTY = { classicBest: 0, classicGames: 0, hiloBest: 0, daily: {} };

export function loadStats() {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...EMPTY };
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
