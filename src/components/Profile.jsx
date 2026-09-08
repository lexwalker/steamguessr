import { loadStats, currentStreak } from '../lib/storage.js';
import { fmt, t } from '../lib/i18n.js';
import { poolLabel } from '../lib/scoring.js';
import { ACHIEVEMENTS, ACH_ICON, breakdown, calibration, dailyGrade, levelInfo, shiftDay, CALIB_WINDOW } from '../lib/progress.js';
import { todayKey } from '../lib/rng.js';

export function GradeBadge({ grade, small }) {
  return <span className={'grade ' + grade + (small ? ' small' : '')}>{grade}</span>;
}

export function XpBar({ info }) {
  return (
    <div className="xp">
      <div className="xp-row">
        <span className="xp-level">{t('profile.level', { n: info.level })}</span>
        <span className="xp-rank">{info.rank}</span>
        <span className="dim">{t('profile.toNext', { n: fmt(info.toNext), l: info.level + 1 })}</span>
      </div>
      <div className="xp-track"><div className="xp-fill" style={{ width: `${Math.min(100, (info.into / info.span) * 100)}%` }}></div></div>
    </div>
  );
}

function ratio(r) {
  return r >= 10 ? fmt(Math.round(r)) : r.toFixed(1);
}

// Twelve weeks of dailies, one column per week, Monday at the top; today is outlined.
function Calendar({ stats, today }) {
  const cols = [];
  const day = (new Date(today.slice(0, 4), Number(today.slice(5, 7)) - 1, Number(today.slice(8))).getDay() + 6) % 7; // Monday = 0
  const start = shiftDay(today, -day - 7 * 11);
  for (let w = 0; w < 12; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const key = shiftDay(start, w * 7 + d);
      const r = stats.daily[key];
      const future = key > today;
      col.push(<span key={key} className={'cal-cell' + (r ? ' g-' + (r.grade || dailyGrade(r.score)) : '') + (key === today ? ' today' : '') + (future ? ' future' : '')} title={key + (r ? ` · ${fmt(r.score)}` : '')}></span>);
    }
    cols.push(<div key={w} className="cal-col">{col}</div>);
  }
  return <div className="calendar">{cols}</div>;
}

export default function Profile({ onExit }) {
  const stats = loadStats();
  const today = todayKey();
  const info = levelInfo(stats.xp);
  const calib = calibration(stats);
  const pools = breakdown(stats, 'p');
  const genres = breakdown(stats, 'g');
  const streak = currentStreak(stats, today);
  const dailies = Object.values(stats.daily);
  const bestDaily = dailies.reduce((m, d) => Math.max(m, d.score || 0), 0);
  const unlocked = ACHIEVEMENTS.filter((id) => stats.ach[id]).length;

  return (
    <section className="profile">
      <div className="profile-head">
        <h2>{t('profile.title')}</h2>
        <button className="link" onClick={onExit}>{t('summary.home')}</button>
      </div>

      <div className="profile-grid">
        <div className="panel">
          <div className="rank-big">{info.rank}</div>
          <XpBar info={info} />
          <div className="dim">{t('profile.xp', { n: fmt(info.xp) })}</div>
          <dl className="kv stats-kv">
            <dt>{t('profile.games')}</dt><dd>{stats.classicGames + stats.hiloGames + stats.mp.games}</dd>
            <dt>{t('profile.dailies')}</dt><dd>{dailies.length}</dd>
            <dt>{t('profile.bestDaily')}</dt><dd>{bestDaily ? <>{fmt(bestDaily)} <GradeBadge grade={dailyGrade(bestDaily)} small /></> : '—'}</dd>
            <dt>{t('profile.mpWins')}</dt><dd>{stats.mp.wins}</dd>
            <dt>{t('profile.hiloBest')}</dt><dd>{stats.hiloBest}</dd>
          </dl>
        </div>

        <div className="panel">
          <div className="crumb">{t('profile.calib')}</div>
          {calib.tier ? (
            <>
              <div className="calib-big">×{ratio(calib.ratio)} <span className={'calib-title tier-' + calib.tier}>{t('calib.' + calib.tier)}</span></div>
              <div className="dim">{t('profile.calibText', { n: Math.min(CALIB_WINDOW, calib.rounds) })}</div>
            </>
          ) : (
            <div className="note">{t('profile.calibFew', { n: calib.need })}</div>
          )}
          <ul className="plain">
            {pools.best && <li>{t('profile.bestPool', { pool: poolLabel(pools.best.id), r: ratio(pools.best.ratio) })}</li>}
            {pools.worst && <li>{t('profile.worstPool', { pool: poolLabel(pools.worst.id), r: ratio(pools.worst.ratio) })}</li>}
            {genres.best && <li>{t('profile.bestGenre', { pool: poolLabel(genres.best.id), r: ratio(genres.best.ratio) })}</li>}
            {genres.worst && <li>{t('profile.worstGenre', { pool: poolLabel(genres.worst.id), r: ratio(genres.worst.ratio) })}</li>}
          </ul>
        </div>

        <div className="panel">
          <div className="crumb">{t('profile.streak')}</div>
          <div className="streak-big">🔥 {streak} <span className="dim">{t('daily.streakBest', { n: stats.streak.best })}</span></div>
          <div className="dim" title={t('daily.freezes', { n: stats.freezes })}>❄️ {t('profile.freezes')}: {stats.freezes}</div>
          <div className="crumb" style={{ marginTop: 14 }}>{t('profile.calendar')}</div>
          <Calendar stats={stats} today={today} />
        </div>
      </div>

      <div className="panel">
        <div className="crumb">{t('profile.ach')} · {t('profile.achCount', { a: unlocked, n: ACHIEVEMENTS.length })}</div>
        <div className="ach-grid">
          {ACHIEVEMENTS.map((id) => (
            <div key={id} className={'ach' + (stats.ach[id] ? '' : ' locked')} title={stats.ach[id] || t('profile.locked')}>
              <span className={'ach-icon' + (ACH_ICON[id] === 'S' ? ' grade S' : '')}>{ACH_ICON[id]}</span>
              <div>
                <div className="ach-name">{t('ach.' + id)}</div>
                <div className="ach-desc">{t('ach.' + id + '.d')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
