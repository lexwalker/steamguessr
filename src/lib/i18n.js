import { useEffect, useReducer } from 'react';
import LOCALES from './locales.js';

// Supported interface languages. `tag` drives Intl number/date formatting.
export const LANGS = [
  { code: 'ru', name: 'Русский', tag: 'ru-RU' },
  { code: 'en', name: 'English', tag: 'en-US' },
  { code: 'zh', name: '简体中文', tag: 'zh-CN' },
  { code: 'ja', name: '日本語', tag: 'ja-JP' },
  { code: 'ko', name: '한국어', tag: 'ko-KR' },
  { code: 'de', name: 'Deutsch', tag: 'de-DE' },
  { code: 'fr', name: 'Français', tag: 'fr-FR' },
  { code: 'es', name: 'Español', tag: 'es-ES' },
  { code: 'pt', name: 'Português (Brasil)', tag: 'pt-BR' },
  { code: 'pl', name: 'Polski', tag: 'pl-PL' },
  { code: 'tr', name: 'Türkçe', tag: 'tr-TR' },
];

const KEY = 'steamguessr-lang';
const listeners = new Set();
let current = detect();
try {
  document.documentElement.lang = current;
} catch {
  /* ignore */
}

function normalize(code) {
  if (!code) return null;
  const c = String(code).toLowerCase();
  if (c.startsWith('zh')) return 'zh';
  if (c.startsWith('pt')) return 'pt';
  const base = c.split('-')[0];
  return LANGS.some((l) => l.code === base) ? base : null;
}

function detect() {
  try {
    const fromUrl = normalize(new URLSearchParams(location.search).get('lang'));
    if (fromUrl) return fromUrl;
    const saved = normalize(localStorage.getItem(KEY));
    if (saved) return saved;
    for (const l of navigator.languages || [navigator.language]) {
      const n = normalize(l);
      if (n) return n;
    }
  } catch {
    /* ignore */
  }
  return 'en';
}

export function getLang() {
  return current;
}

export function langTag() {
  return (LANGS.find((l) => l.code === current) || LANGS[1]).tag;
}

export function setLang(code) {
  const n = normalize(code) || 'en';
  current = n;
  try {
    localStorage.setItem(KEY, n);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = n;
  listeners.forEach((fn) => fn());
  ensureDescs(n);
}

// Re-renders the component when the language changes.
export function useLang() {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => listeners.delete(force);
  }, []);
  return current;
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

function pluralForm(forms, n) {
  let cat = 'other';
  try {
    cat = new Intl.PluralRules(langTag()).select(n);
  } catch {
    /* ignore */
  }
  return forms[cat] ?? forms.other ?? forms.many ?? forms.one ?? '';
}

// t('key', { vars }) — plural entries are objects keyed by CLDR category and use vars.n.
export function t(key, vars) {
  const dict = LOCALES[current] || LOCALES.en;
  let s = dict[key];
  if (s === undefined) s = LOCALES.en[key];
  if (s === undefined) return key;
  if (typeof s === 'object') s = pluralForm(s, vars && typeof vars.n === 'number' ? vars.n : 0);
  return interpolate(s, vars);
}

export function fmt(n) {
  const v = Math.round(Number(n) || 0);
  try {
    return new Intl.NumberFormat(langTag()).format(v);
  } catch {
    return String(v);
  }
}

// 1000 -> "1K" / "1 тыс." / "1万" for slider marks.
export function fmtCompact(n) {
  try {
    return new Intl.NumberFormat(langTag(), { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return String(n);
  }
}

// Dates come as ISO (YYYY-MM-DD) from the dataset; anything else is shown as is.
export function fmtDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return s || '—';
  try {
    return new Intl.DateTimeFormat(langTag(), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  } catch {
    return s;
  }
}

// "2.4× more than the truth" — Russian needs its own numeral agreement.
export function ratioText(guess, actual) {
  const g = guess + 1;
  const a = actual + 1;
  const r = g > a ? g / a : a / g;
  if (r < 1.05) return t('ratio.exact');
  const key = g > a ? 'ratio.higher' : 'ratio.lower';
  if (r < 10) return t(key, { r: new Intl.NumberFormat(langTag(), { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(r), word: t('ratio.timesFew') });
  const n = Math.round(r);
  let word = t('ratio.times');
  if (current === 'ru') {
    const m10 = n % 10;
    const m100 = n % 100;
    word = m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14) ? 'раза' : 'раз';
  }
  return t(key, { r: fmt(n), word });
}

// Steam's rating label for a share of positive reviews (count thresholds ignored).
export function ratingTier(pct) {
  if (pct >= 95) return { id: 'op', tone: 'positive' };
  if (pct >= 80) return { id: 'vp', tone: 'positive' };
  if (pct >= 70) return { id: 'mp', tone: 'positive' };
  if (pct >= 40) return { id: 'mixed', tone: 'mixed' };
  if (pct >= 20) return { id: 'mn', tone: 'negative' };
  return { id: 'on', tone: 'negative' };
}

// Steam's own review summary (score 1–9) for a game from the dataset.
export function scoreLabel(game) {
  const s = game.score | 0;
  if (s >= 1 && s <= 9) return t('score.' + s);
  if (game.reviews > 0) return t('score.few', { n: game.reviews });
  return t('score.none');
}

// Descriptions live in public/data/desc/<lang>.json (one file per interface language), loaded on
// demand; games.json itself carries no text besides the name.
const DESCS = {};
const descLoading = {};

export function ensureDescs(code = current) {
  if (DESCS[code]) return Promise.resolve();
  if (descLoading[code]) return descLoading[code];
  descLoading[code] = fetch(`${import.meta.env.BASE_URL}data/desc/${code}.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((d) => {
      DESCS[code] = d || {};
      delete descLoading[code];
      listeners.forEach((fn) => fn());
    });
  return descLoading[code];
}

export function gameDesc(game) {
  const own = DESCS[current];
  if (own && own[game.id]) return own[game.id];
  // while the current language is still loading, any loaded one beats an empty card
  for (const code of Object.keys(DESCS)) if (DESCS[code][game.id]) return DESCS[code][game.id];
  return game.desc || '';
}

// Genres are shown only for games without tags; the dataset holds them in Russian plus English.
export function gameGenres(game) {
  if (current !== 'ru' && Array.isArray(game.genresEn) && game.genresEn.length) return game.genresEn;
  return game.genres || [];
}
