import { fmt, ratioText, positivePct, reviewsWord } from '../lib/scoring.js';
import { steamUrl } from '../lib/data.js';

export default function RoundResult({ game, result, isLast, onNext }) {
  const pct = positivePct(game);
  const grade = result.score >= 4000 ? 'great' : result.score >= 2500 ? 'ok' : result.score >= 1000 ? 'meh' : 'bad';
  const verdict = { great: 'Отлично!', ok: 'Неплохо', meh: 'Мимо, но рядом', bad: 'Совсем не туда' }[grade];

  return (
    <section className={'result ' + grade}>
      <div className="result-score">
        <span className="result-points">+{fmt(result.score)}</span>
        <span className="result-verdict">{verdict}</span>
        {result.hints.length > 0 && <span className="result-note">потолок раунда {fmt(result.max)}</span>}
      </div>
      <div className="result-truth">
        <div className="truth-line">
          <strong>{fmt(game.reviews)}</strong> {reviewsWord(game.reviews)}
          {game.scoreDesc && <> · {game.scoreDesc}</>}
          {game.reviews > 0 && <> ({pct}% положительных)</>}
        </div>
        <div className="truth-guess">Твой ответ: {fmt(result.guess)}, {ratioText(result.guess, game.reviews)}.</div>
      </div>
      <div className="result-actions">
        <a className="btn" href={steamUrl(game)} target="_blank" rel="noreferrer">Открыть в Steam</a>
        <button className="btn primary big" onClick={onNext} autoFocus>{isLast ? 'Итоги' : 'Дальше'}</button>
      </div>
    </section>
  );
}
