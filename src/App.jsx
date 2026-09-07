import { useEffect, useState } from 'react';
import { loadGames } from './lib/data.js';
import { randomSeed, todayKey } from './lib/rng.js';
import Home from './components/Home.jsx';
import ClassicGame from './components/ClassicGame.jsx';
import HigherLower from './components/HigherLower.jsx';
import ThemeSwitch from './components/ThemeSwitch.jsx';

function screenFromUrl() {
  const p = new URLSearchParams(location.search);
  const mode = p.get('mode');
  if (mode === 'classic') return { name: 'classic', pool: p.get('pool') || 'mix', seed: p.get('seed') || randomSeed() };
  if (mode === 'daily') return { name: 'classic', daily: true, pool: 'mix', seed: 'daily-' + todayKey() };
  if (mode === 'hilo') return { name: 'hilo', seed: p.get('seed') || randomSeed() };
  return { name: 'home' };
}

function urlFor(s) {
  if (s.name === 'classic' && s.daily) return '?mode=daily';
  if (s.name === 'classic') return `?mode=classic&pool=${s.pool}&seed=${s.seed}`;
  if (s.name === 'hilo') return `?mode=hilo&seed=${s.seed}`;
  return location.pathname;
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [screen, setScreenState] = useState(screenFromUrl);

  useEffect(() => {
    loadGames().then(setData).catch(setError);
  }, []);

  useEffect(() => {
    const onPop = () => setScreenState(screenFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function go(s) {
    history.pushState(null, '', urlFor(s));
    setScreenState(s);
  }

  let body;
  if (error) {
    body = (
      <div className="notice">
        <h2>Датасет не найден</h2>
        <p>Собери его командой ниже, она положит файл в <code>public/data/games.json</code>. Первые игры появятся через пару минут, дальше файл дописывается по ходу сбора.</p>
        <pre>npm run dataset</pre>
      </div>
    );
  } else if (!data) {
    body = <div className="notice">Загружаю датасет…</div>;
  } else if (screen.name === 'classic') {
    body = (
      <ClassicGame
        key={screen.seed + screen.pool}
        data={data}
        seed={screen.seed}
        pool={screen.pool}
        daily={!!screen.daily}
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
  } else {
    body = <Home data={data} onStart={go} />;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <button className="logo" onClick={() => go({ name: 'home' })}>
            <span className="logo-mark">?</span> SteamGuessr
          </button>
          <ThemeSwitch />
        </div>
        {data && <span className="header-meta">{data.games.length} игр · датасет {data.version}</span>}
      </header>
      <main className="main">{body}</main>
      <footer className="footer">
        Игра для своих. Числа берутся из открытых данных Steam, продажи и вишлисты Steam не публикует, поэтому угадываем отзывы.
      </footer>
    </div>
  );
}
