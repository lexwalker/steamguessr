import { useMemo, useState } from 'react';
import { POOLS, ROUND_TOTAL, ROUNDS, poolLabel, poolHint } from '../lib/scoring.js';
import { fmt, fmtDate, t } from '../lib/i18n.js';
import { loadStats, currentStreak } from '../lib/storage.js';
import { poolGames } from '../lib/data.js';
import { mulberry32, randomSeed, seededShuffle, todayKey } from '../lib/rng.js';

function IconTarget() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1"></circle>
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>
    </svg>
  );
}
function IconScales() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18M5 21h14M3 8l4 8H1l2-8zM17 8l4 8h-6l2-8zM3 8h18"></path>
    </svg>
  );
}
function IconPeople() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><circle cx="17" cy="9" r="2.5"></circle><path d="M15.5 14.5a5 5 0 0 1 6 4.5"></path>
    </svg>
  );
}

export default function Home({ data, onStart }) {
  const [pool, setPool] = useState('mix');
  const [code, setCode] = useState('');
  const stats = loadStats();
  const today = todayKey();
  const dailyDone = stats.daily[today];
  const streak = currentStreak(stats, today);

  // capsules drifting behind the title, reshuffled on every visit
  const band = useMemo(() => {
    const known = data.games.filter((g) => g.reviews >= 5000);
    return seededShuffle(known.length >= 14 ? known : data.games, mulberry32(Date.now() % 100000)).slice(0, 14);
  }, [data]);

  const counts = useMemo(() => Object.fromEntries(POOLS.map((p) => [p.id, poolGames(data.games, p.id).length])), [data]);
  const chip = (p) => (
    <button
      key={p.id}
      className={'chip' + (pool === p.id ? ' active' : '')}
      disabled={counts[p.id] < ROUNDS}
      title={t('poolHint.count', { hint: poolHint(p), n: fmt(counts[p.id]) })}
      onClick={() => setPool(p.id)}
    >
      {poolLabel(p.id)} <span className="chip-n">{counts[p.id]}</span>
    </button>
  );
  const startClassic = () => onStart({ name: 'classic', pool, seed: randomSeed() });

  return (
    <div className="home">
      <section className="hero-wrap">
        <div className="hero-bg" aria-hidden="true">
          <div className="band-row">
            {[...band, ...band].map((g, i) => <img key={g.id + '-' + i} src={g.img} alt="" />)}
          </div>
        </div>
        <div className="hero">
          <h1>{t('home.title')}</h1>
          <p>{t('home.sub')}</p>
          <div className="hero-actions">
            <button className="btn primary big" onClick={startClassic}>{t('home.play')}</button>
            <button className="btn big" onClick={() => onStart({ name: 'mp', lobby: null })}>{t('home.playTogether')}</button>
          </div>
        </div>
      </section>

      <div className="modes">
        <section className="mode">
          <div className="mode-head"><span className="mode-icon"><IconTarget /></span><h2>{t('home.classic')}</h2></div>
          <p>{t('home.classicDesc', { n: ROUNDS, max: fmt(ROUNDS * ROUND_TOTAL) })}</p>
          <div className="pool-groups">
            <div className="chips">{POOLS.filter((p) => !p.byTag).map(chip)}</div>
            <div className="chips">{POOLS.filter((p) => p.byTag).map(chip)}</div>
          </div>
          <div className="mode-actions">
            <button className="btn primary" onClick={startClassic}>{t('home.play')}</button>
            {stats.classicGames > 0 && <span className="mode-stats">{t('home.best', { best: fmt(stats.classicBest), games: stats.classicGames })}</span>}
          </div>
        </section>

        <section className="mode">
          <div className="mode-head"><span className="mode-icon"><IconPeople /></span><h2>{t('home.together')}</h2></div>
          <p>{t('home.togetherDesc')}</p>
          <form className="mp-join" onSubmit={(e) => { e.preventDefault(); if (code.length === 5) onStart({ name: 'mp', lobby: code }); }}>
            <input className="typed code" maxLength={5} placeholder={t('home.codePlaceholder')} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} aria-label={t('mp.lobbyCode')} />
            <button type="submit" className="btn" disabled={code.length !== 5}>{t('home.joinByCode')}</button>
          </form>
          <div className="mode-actions">
            <button className="btn primary" onClick={() => onStart({ name: 'mp', lobby: null })}>{t('home.createLobby')}</button>
          </div>
        </section>

        <section className="mode">
          <div className="mode-head"><span className="mode-icon"><IconCalendar /></span><h2>{t('home.daily')}</h2></div>
          <p>{t('home.dailyDesc', { date: fmtDate(today) })}</p>
          <div className="mode-actions">
            <button className="btn primary" onClick={() => onStart({ name: 'classic', daily: true, pool: 'mix', seed: 'daily-' + today })}>
              {dailyDone ? t('home.seeResult') : t('home.playDaily')}
            </button>
            <span className="mode-stats">
              {dailyDone ? <>{fmt(dailyDone.score)} {dailyDone.grid} · </> : null}
              {streak > 0 ? t('summary.streak', { n: streak }) : t('home.noStreak')}
            </span>
          </div>
        </section>

        <section className="mode">
          <div className="mode-head"><span className="mode-icon"><IconScales /></span><h2>{t('home.hilo')}</h2></div>
          <p>{t('home.hiloDesc')}</p>
          <div className="mode-actions">
            <button className="btn primary" onClick={() => onStart({ name: 'hilo', seed: randomSeed() })}>{t('home.play')}</button>
            {stats.hiloBest > 0 && <span className="mode-stats">{t('home.record', { n: stats.hiloBest })}</span>}
          </div>
        </section>
      </div>

      <details className="howto">
        <summary>{t('home.howScored')}</summary>
        <ul>
          <li>{t('home.how1')}</li>
          <li>{t('home.how2')}</li>
          <li>{t('home.how3')}</li>
          <li>{t('home.how4')}</li>
        </ul>
      </details>
    </div>
  );
}
