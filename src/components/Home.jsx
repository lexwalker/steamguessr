import { useEffect, useMemo, useState } from 'react';
import { POOLS, ROUND_TOTAL, ROUNDS, poolLabel, poolHint } from '../lib/scoring.js';
import { fmt, fmtDate, t } from '../lib/i18n.js';
import { loadStats, currentStreak, streakProtected } from '../lib/storage.js';
import { poolGames } from '../lib/data.js';
import { mulberry32, randomSeed, seededShuffle, todayKey } from '../lib/rng.js';
import { ACHIEVEMENTS, WEEKLY, calibration, dailyNumber, dailyPool, levelInfo, msToMidnight, weekKey } from '../lib/progress.js';
import { GradeBadge, XpBar } from './Profile.jsx';

function IconTarget() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1"></circle>
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
function IconUser() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>
    </svg>
  );
}

function useCountdown() {
  const [ms, setMs] = useState(msToMidnight());
  useEffect(() => {
    const id = setInterval(() => setMs(msToMidnight()), 30000);
    return () => clearInterval(id);
  }, []);
  return { h: Math.floor(ms / 3600000), m: Math.floor((ms % 3600000) / 60000) };
}

// The daily is the centre of the home page: today's number and theme, the result if it is done,
// the streak with its freezes, and the weekly challenge line underneath.
function DailyHero({ stats, today, onStart }) {
  const done = stats.daily[today];
  const streak = currentStreak(stats, today);
  const protectedStreak = streakProtected(stats, today);
  const left = useCountdown();
  const pool = dailyPool(today);
  const wk = weekKey(today);
  const weeklyDone = stats.weekly[wk];
  return (
    <section className="daily-hero">
      <div className="daily-head">
        <span className="daily-title">{t('daily.number', { n: dailyNumber(today) })} · {fmtDate(today)}</span>
        <span className="chip theme">{t('daily.theme', { pool: poolLabel(pool) })}</span>
      </div>
      {done ? (
        <div className="daily-result">
          <GradeBadge grade={done.grade || 'D'} />
          <div>
            <div className="daily-score">{fmt(done.score)} <span className="dim">{t('summary.of', { max: fmt(ROUNDS * ROUND_TOTAL) })}</span></div>
            <div className="summary-grid">{done.grid}</div>
          </div>
        </div>
      ) : (
        <p className="daily-desc">{t('daily.desc')}</p>
      )}
      <div className="daily-actions">
        <button className="btn primary big" onClick={() => onStart({ name: 'classic', daily: true, pool, seed: 'daily-' + today })}>
          {done ? t('home.seeResult') : t('daily.play')}
        </button>
        <span className="pill streak" title={t('daily.streakBest', { n: stats.streak.best })}>🔥 {streak > 0 ? t('summary.streak', { n: streak }).replace('🔥 ', '') : t('home.noStreak')}</span>
        {stats.freezes > 0 && <span className="pill freeze" title={t('daily.freezes', { n: stats.freezes })}>❄️ ×{stats.freezes}</span>}
        {protectedStreak && <span className="dim">{t('daily.protected')}</span>}
        <span className="dim daily-next">{t('daily.nextIn', left)}</span>
      </div>
      <div className="weekly-line">
        <span className="weekly-icon">🏆</span>
        <b>{t('weekly.title')}</b>
        <span className="dim">· {t('weekly.name', { w: wk.slice(6) })} · {t('weekly.rules')}</span>
        {weeklyDone
          ? <button className="link" onClick={() => onStart({ name: 'classic', weekly: true, pool: WEEKLY.pool, seed: 'weekly-' + wk })}>{t('weekly.done', { score: fmt(weeklyDone.score) })}</button>
          : <button className="btn small" onClick={() => onStart({ name: 'classic', weekly: true, pool: WEEKLY.pool, seed: 'weekly-' + wk })}>{t('weekly.play')}</button>}
      </div>
    </section>
  );
}

export default function Home({ data, onStart }) {
  const [pool, setPool] = useState('mix');
  const [code, setCode] = useState('');
  const stats = loadStats();
  const today = todayKey();
  const info = levelInfo(stats.xp);
  const calib = calibration(stats);
  const unlocked = ACHIEVEMENTS.filter((id) => stats.ach[id]).length;

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
          <DailyHero stats={stats} today={today} onStart={onStart} />
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
          <div className="mode-head"><span className="mode-icon"><IconScales /></span><h2>{t('home.hilo')}</h2></div>
          <p>{t('home.hiloDesc')}</p>
          <div className="mode-actions">
            <button className="btn primary" onClick={() => onStart({ name: 'hilo', seed: randomSeed() })}>{t('home.play')}</button>
            {stats.hiloBest > 0 && <span className="mode-stats">{t('home.record', { n: stats.hiloBest })}</span>}
          </div>
        </section>

        <section className="mode profile-card">
          <div className="mode-head"><span className="mode-icon"><IconUser /></span><h2>{t('home.profile')}</h2></div>
          <XpBar info={info} />
          <p>
            {calib.tier
              ? <>{t('profile.calib')}: <b>×{calib.ratio >= 10 ? fmt(Math.round(calib.ratio)) : calib.ratio.toFixed(1)}</b> · {t('calib.' + calib.tier)}</>
              : t('profile.calibFew', { n: calib.need })}
            <br />
            {t('profile.ach')}: {t('profile.achCount', { a: unlocked, n: ACHIEVEMENTS.length })}
          </p>
          <div className="mode-actions">
            <button className="btn" onClick={() => onStart({ name: 'profile' })}>{t('profile.open')}</button>
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
