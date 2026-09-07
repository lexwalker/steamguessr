export const THEMES = [
  { id: 'steam', label: 'Steam', hint: 'тёмная, как магазин Steam', swatch: ['#1b2838', '#66c0f4'] },
  { id: 'neon', label: 'Неон', hint: 'аркада: лайм и маджента', swatch: ['#0b0b10', '#d7ff3d'] },
  { id: 'paper', label: 'Бумага', hint: 'светлая, журнальная', swatch: ['#f4efe6', '#b6432a'] },
  { id: 'mono', label: 'Минимал', hint: 'чёрный фон, один акцент', swatch: ['#0e0e10', '#ff5c00'] },
];

const KEY = 'steamguessr-theme';

export function isTheme(id) {
  return THEMES.some((t) => t.id === id);
}

export function currentTheme() {
  const id = document.documentElement.dataset.theme;
  return isTheme(id) ? id : 'steam';
}

export function themeLabel(id) {
  const t = THEMES.find((x) => x.id === id);
  return t ? t.label : id;
}

export function applyTheme(id) {
  if (!isTheme(id)) id = 'steam';
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* storage unavailable: the choice lives for this page only */
  }
  return id;
}
