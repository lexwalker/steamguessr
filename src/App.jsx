import { useEffect, useReducer, useState } from 'react';
import { loadGames } from './lib/data.js';
import { randomSeed, todayKey } from './lib/rng.js';
import { ensureDescs, fmt, t, useLang } from './lib/i18n.js';
import { loadStats, onStatsChange } from './lib/storage.js';
import { WEEKLY, dailyPool, levelInfo, weekKey } from './lib/progress.js';
import Home from './components/Home.jsx';
import ClassicGame from './components/ClassicGame.jsx';
import HigherLower from './components/HigherLower.jsx';
import Multiplayer from './components/Multiplayer.jsx';
import Profile from './components/Profile.jsx';
import LangSwitch from './components/LangSwitch.jsx';
import Toasts from './components/Toast.jsx';

function screenFromUrl() {
  const p = new URLSearchParams(location.search);
  const mode = p.get('mode');
  const today = todayKey();
  if (mode === 'classic') {
    // daily / weekly seeds cannot be pre-played through the classic mode
    const seed = p.get('seed');
    return { name: 'classic', pool: p.get('pool') || 'mix', seed: seed && !/^(daily|weekly)-/.test(seed) ? seed : randomSeed() };
  }
  if (mode === 'daily') return { name: 'classic', daily: true, pool: dailyPool(today), seed: 'daily-' + today };
  if (mode === 'weekly') return { name: 'classic', weekly: true, pool: WEEKLY.pool, seed: 'weekly-' + weekKey(today) };
  if (mode === 'hilo') return { name: 'hilo', seed: p.get('seed') || randomSeed() };
  if (mode === 'mp') return { name: 'mp', lobby: (p.get('lobby') || '').toUpperCase() || null };
  if (mode === 'profile') return { name: 'profile' };
  return { name: 'home' };
}

function urlFor(s) {
  if (s.name === 'classic' && s.daily) return '?mode=daily';
  if (s.name === 'classic' && s.weekly) return '?mode=weekly';
  if (s.name === 'classic') return `?mode=classic&pool=${s.pool}&seed=${s.seed}`;
  if (s.name === 'hilo') return `?mode=hilo&seed=${s.seed}`;
  if (s.name === 'mp') return s.lobby ? `?mode=mp&lobby=${s.lobby}` : '?mode=mp';
  if (s.name === 'profile') return '?mode=profile';
  return location.pathname;
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [screen, setScreenState] = useState(screenFromUrl);
  // The whole tree re-renders on a language change; every string below goes through t().
  useLang();
  const [, bump] = useReducer((x) => x + 1, 0);
  useEffect(() => onStatsChange(bump), []);

  useEffect(() => {
    ensureDescs();
    loadGames().then(setData).catch(setError);
  }, []);

  useEffect(() => {
    if (screen.name === 'classic' && !screen.daily && !screen.weekly && location.search !== urlFor(screen)) history.replaceState(null, '', urlFor(screen));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPop = () => setScreenState(screenFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function go(s) {
    history.pushState(null, '', urlFor(s));
    setScreenState(s);
    window.scrollTo(0, 0);
  }

  const level = levelInfo(loadStats().xp);

  let body;
  if (error) {
    body = (
      <div className="notice">
        <h2>{t('app.noDataTitle')}</h2>
        <p>{t('app.noDataText')}</p>
        <pre>npm run dataset</pre>
      </div>
    );
  } else if (!data) {
    body = <div className="notice">{t('app.loading')}</div>;
  } else if (screen.name === 'classic') {
    body = (
      <ClassicGame
        key={screen.seed + screen.pool}
        data={data}
        seed={screen.seed}
        pool={screen.pool}
        daily={!!screen.daily}
        weekly={!!screen.weekly}
        rounds={screen.weekly ? WEEKLY.rounds : undefined}
        timer={screen.weekly ? WEEKLY.timer : 0}
        onExit={() => go({ name: 'home' })}
        onReplay={() => go({ name: 'classic', pool: screen.pool, seed: randomSeed() })}
      />
    );
  } else if (screen.name === 'hilo') {
    body = (
      <HigherLower
        key={screen.seed}
        data={data}
        seed={screen.seed}
        onExit={() => go({ name: 'home' })}
        onReplay={() => go({ name: 'hilo', seed: randomSeed() })}
      />
    );
  } else if (screen.name === 'mp') {
    body = (
      <Multiplayer
        data={data}
        lobby={screen.lobby}
        onLobby={(code) => go({ name: 'mp', lobby: code })}
        onExit={() => go({ name: 'home' })}
      />
    );
  } else if (screen.name === 'profile') {
    body = <Profile onExit={() => go({ name: 'home' })} />;
  } else {
    body = <Home data={data} onStart={go} />;
  }

  return (
    <div className="app">
      <header className="header">
        <button className="logo" onClick={() => go({ name: 'home' })}>
          <span className="logo-mark">?</span> SteamGuessr
        </button>
        {data && <span className="header-meta">{t('app.meta', { n: fmt(data.games.length), v: data.version })}</span>}
        <button className="level-badge" onClick={() => go({ name: 'profile' })} title={`${t('profile.level', { n: level.level })} · ${level.rank}`}>
          <span className="level-num">{t('xp.level', { n: level.level })}</span>
          <span className="level-rank">{level.rank}</span>
        </button>
        <LangSwitch />
      </header>
      <main className="main">{body}</main>
      <footer className="footer">{t('app.footer')}</footer>
      <Toasts />
    </div>
  );
}
