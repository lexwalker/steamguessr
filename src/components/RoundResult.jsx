import { useEffect, useState } from 'react';
import { fmt, ratioText, positivePct, valueToSlider } from '../lib/scoring.js';
import { steamUrl } from '../lib/data.js';
import { MARKS, markLabel } from './GuessSlider.jsx';

// Steam colours its review summary by share of positive reviews.
export function reviewTone(game) {
  if (game.reviews < 10) return 'few';
  const pct = positivePct(game);
  if (pct >= 70) return 'positive';
  if (pct >= 40) return 'mixed';
  return 'negative';
}

function useCountUp(target, ms = 800) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setV(Math.round(target * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function ScaleBar({ guess, actual }) {
  const g = valueToSlider(guess) * 100;
  const a = valueToSlider(actual) * 100;
  return (
    <div className="scale" aria-hidden="true">
      <div className="scale-track">
        <div className="scale-gap" style={{ left: `${Math.min(g, a)}%`, width: `${Math.abs(g - a)}%` }}></div>
        {MARKS.map((m) => <span key={m} className="scale-tick" style={{ left: `${valueToSlider(m) * 100}%` }}></span>)}
        <div className="scale-mark mark-guess" style={{ left: `${g}%` }}><span>ты</span></div>
        <div className="scale-mark mark-truth" style={{ left: `${a}%` }}><span>правда</span></div>
      </div>
      <div className="scale-labels">
        {MARKS.map((m) => <span key={m} style={{ left: `${valueToSlider(m) * 100}%` }}>{markLabel(m)}</span>)}
      </div>
    </div>
  );
}

export default function RoundResult({ game, result, isLast, onNext }) {
  const pct = positivePct(game);
  const grade = result.score >= 4000 ? 'great' : result.score >= 2500 ? 'ok' : result.score >= 1000 ? 'meh' : 'bad';
  const verdict = { great: 'Отлично!', ok: 'Неплохо', meh: 'Мимо, но рядом', bad: 'Совсем не туда' }[grade];
  const shown = useCountUp(result.score);

  return (
    <section className={'result ' + grade}>
      <div className="result-score">
        <span className="result-points">+{fmt(shown)}</span>
        <span className="result-verdict">{verdict}</span>
        {result.hints.length > 0 && <span className="result-note">потолок раунда {fmt(result.max)}</span>}
      </div>

      <div className="review-line">
        <span className="review-label">Все обзоры:</span>
        <span className={'review-desc ' + reviewTone(game)}>{game.scoreDesc || (game.reviews ? '' : 'Отзывов пока нет')}</span>
        <span className="review-count">({fmt(game.reviews)})</span>
      </div>
      <div className="truth-guess">
        {game.reviews > 0 && <>{pct}% из {fmt(game.reviews)} отзывов положительные. </>}
        Твой ответ: {fmt(result.guess)}, {ratioText(result.guess, game.reviews)}.
      </div>

      <ScaleBar guess={result.guess} actual={game.reviews} />

      <div className="result-actions">
        <a className="btn" href={steamUrl(game)} target="_blank" rel="noreferrer">Открыть в Steam</a>
        <button className="btn primary big" onClick={onNext} autoFocus>{isLast ? 'Итоги' : 'Дальше'}</button>
      </div>
    </section>
  );
}
