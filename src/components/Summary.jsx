import { useState } from 'react';
import { scoreEmoji, poolLabel, ROUND_TOTAL } from '../lib/scoring.js';
import { fmt, fmtDate, t } from '../lib/i18n.js';
import { steamUrl } from '../lib/data.js';
import { loadStats, currentStreak } from '../lib/storage.js';
import { dailyNumber, levelInfo } from '../lib/progress.js';
import { GradeBadge } from './Profile.jsx';

function copy(text) {
  try {
    return navigator.clipboard.writeText(text);
  } catch {
    return Promise.reject(new Error('clipboard unavailable'));
  }
}

export default function Summary({ games, results, total, daily, weekly, dateKey, weekKey, pool, finish, onExit, onReplay }) {
  const [copied, setCopied] = useState('');
  const max = games.length * ROUND_TOTAL;
  const grid = results.map((r) => scoreEmoji(r.main ?? r.score)).join('');
  const link = location.origin + location.pathname + location.search;
  const title = daily
    ? `${t('summary.dailyN', { n: dailyNumber(dateKey) })} · ${fmtDate(dateKey)}`
    : weekly ? t('summary.weekly', { w: weekKey }) : t('summary.classic', { pool: poolLabel(pool) });
  const stats = loadStats();
  const streak = daily ? currentStreak(stats, dateKey) : 0;
  const info = levelInfo(stats.xp);
  const grade = finish && finish.grade;
  const lines = [`SteamGuessr · ${title}${grade ? ` · ${grade}` : ''}`, `${fmt(total)} / ${fmt(max)}`, grid];
  const tail = [streak > 0 ? t('summary.streak', { n: streak }) : '', `${t('xp.level', { n: info.level })} · ${info.rank}`].filter(Boolean).join(' · ');
  if (tail) lines.push(tail);
  lines.push(link);
  const shareText = lines.join('\n');

  function share(kind, text) {
    copy(text).then(() => setCopied(kind)).catch(() => setCopied('fail'));
    setTimeout(() => setCopied(''), 2000);
  }

  return (
    <section className="summary">
      <h2>{title}</h2>
      <div className="summary-total">
        {grade && <GradeBadge grade={grade} />}
        <span className="summary-points">{fmt(total)}</span>
        <span className="summary-max">{t('summary.of', { max: fmt(max) })}</span>
        {finish && finish.xp > 0 && <span className="summary-xp">{t('xp.gained', { n: fmt(finish.xp) })}</span>}
        {daily && streak > 0 && <span className="summary-streak">{t('summary.streak', { n: streak })}</span>}
        <span className="summary-grid">{grid}</span>
      </div>

      <table className="rounds">
        <thead>
          <tr><th>#</th><th>{t('summary.hGame')}</th><th>{t('summary.hAnswer')}</th><th>{t('summary.hTruth')}</th><th>{t('summary.hScore')}</th></tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>
                <a className="round-game" href={steamUrl(games[i])} target="_blank" rel="noreferrer">
                  <img className="capsule" src={games[i].img} alt="" loading="lazy" />
                  <span>{games[i].name}</span>
                </a>
              </td>
              <td>{fmt(r.guess)}{typeof r.pct === 'number' ? <span className="dim"> · {r.pct}%</span> : null}</td>
              <td>{fmt(games[i].reviews)}{games[i].reviews > 0 ? <span className="dim"> · {Math.round(games[i].pos / games[i].reviews * 100)}%</span> : null}</td>
              <td>{scoreEmoji(r.main ?? r.score)} {fmt(r.main ?? r.score)}{r.bonus ? <span className="dim"> +{fmt(r.bonus)}</span> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="summary-actions">
        <button className="btn" onClick={() => share('result', shareText)}>
          {copied === 'result' ? t('summary.copied') : t('summary.copy')}
        </button>
        {!weekly && (
          <button className="btn" onClick={() => share('link', link)}>
            {copied === 'link' ? t('summary.copied') : daily ? t('summary.dailyLink') : t('summary.duelLink')}
          </button>
        )}
        {copied === 'fail' && <span className="note">{t('summary.clipboardFail')}</span>}
      </div>

      <div className="summary-actions">
        {!daily && !weekly && <button className="btn primary big" onClick={onReplay}>{t('summary.again')}</button>}
        {daily && <span className="note">{t('summary.tomorrow')}</span>}
        <button className="btn" onClick={onExit}>{t('summary.home')}</button>
      </div>
    </section>
  );
}
