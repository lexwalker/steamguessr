import { useState } from 'react';
import { scoreEmoji, poolLabel, ROUND_TOTAL } from '../lib/scoring.js';
import { fmt, fmtDate, t } from '../lib/i18n.js';
import { steamUrl } from '../lib/data.js';
import { loadStats, currentStreak } from '../lib/storage.js';

function copy(text) {
  try {
    return navigator.clipboard.writeText(text);
  } catch {
    return Promise.reject(new Error('clipboard unavailable'));
  }
}

export default function Summary({ games, results, total, daily, dateKey, pool, onExit, onReplay }) {
  const [copied, setCopied] = useState('');
  const max = games.length * ROUND_TOTAL;
  const grid = results.map((r) => scoreEmoji(r.main ?? r.score)).join('');
  const link = location.origin + location.pathname + location.search;
  const title = daily ? t('summary.daily', { date: fmtDate(dateKey) }) : t('summary.classic', { pool: poolLabel(pool) });
  const streak = daily ? currentStreak(loadStats(), dateKey) : 0;
  const streakLine = streak > 1 ? `\n${t('summary.streak', { n: streak })}` : '';
  const shareText = `SteamGuessr · ${title}\n${fmt(total)} / ${fmt(max)}\n${grid}${streakLine}\n${link}`;

  function share(kind, text) {
    copy(text).then(() => setCopied(kind)).catch(() => setCopied('fail'));
    setTimeout(() => setCopied(''), 2000);
  }

  return (
    <section className="summary">
      <h2>{title}</h2>
      <div className="summary-total">
        <span className="summary-points">{fmt(total)}</span>
        <span className="summary-max">{t('summary.of', { max: fmt(max) })}</span>
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
        <button className="btn" onClick={() => share('link', link)}>
          {copied === 'link' ? t('summary.copied') : daily ? t('summary.dailyLink') : t('summary.duelLink')}
        </button>
        {copied === 'fail' && <span className="note">{t('summary.clipboardFail')}</span>}
      </div>

      <div className="summary-actions">
        {!daily && <button className="btn primary big" onClick={onReplay}>{t('summary.again')}</button>}
        {daily && <span className="note">{t('summary.tomorrow')}</span>}
        <button className="btn" onClick={onExit}>{t('summary.home')}</button>
      </div>
    </section>
  );
}
