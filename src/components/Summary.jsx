import { useState } from 'react';
import { fmt, scoreEmoji, poolLabel, ROUND_TOTAL, daysWord } from '../lib/scoring.js';
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
  const title = daily ? `Дейли ${dateKey.split('-').reverse().join('.')}` : `Классика · ${poolLabel(pool)}`;
  const streak = daily ? currentStreak(loadStats(), dateKey) : 0;
  const streakLine = streak > 1 ? `\n🔥 ${streak} ${daysWord(streak)} подряд` : '';
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
        <span className="summary-max">из {fmt(max)}</span>
        {daily && streak > 0 && <span className="summary-streak">🔥 {streak} {daysWord(streak)} подряд</span>}
        <span className="summary-grid">{grid}</span>
      </div>

      <table className="rounds">
        <thead>
          <tr><th>#</th><th>Игра</th><th>Ответ</th><th>Правда</th><th>Очки</th></tr>
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
          {copied === 'result' ? 'Скопировано!' : 'Скопировать результат'}
        </button>
        <button className="btn" onClick={() => share('link', link)}>
          {copied === 'link' ? 'Скопировано!' : daily ? 'Ссылка на дейли' : 'Ссылка на дуэль'}
        </button>
        {copied === 'fail' && <span className="note">Буфер обмена недоступен, скопируй адрес из строки браузера.</span>}
      </div>

      <div className="summary-actions">
        {!daily && <button className="btn primary big" onClick={onReplay}>Ещё партию</button>}
        {daily && <span className="note">Новый набор появится завтра.</span>}
        <button className="btn" onClick={onExit}>На главную</button>
      </div>
    </section>
  );
}
