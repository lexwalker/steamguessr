import { useEffect, useState } from 'react';
import { positivePct, valueToSlider } from '../lib/scoring.js';
import { fmt, ratioText, scoreLabel, t } from '../lib/i18n.js';
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

export function useCountUp(target, ms = 800) {
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

export function gradeOf(main) {
  return main >= 4000 ? 'great' : main >= 2500 ? 'ok' : main >= 1000 ? 'meh' : 'bad';
}

// Log scale with one marker per guess and the truth marker sliding in from the first guess.
export function ScaleBar({ guesses, actual, compact = false }) {
  const a = valueToSlider(actual) * 100;
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const first = guesses.length ? valueToSlider(guesses[0].value) * 100 : a;
  const truthPos = revealed ? a : first;
  const lo = Math.min(truthPos, ...guesses.map((g) => valueToSlider(g.value) * 100));
  const hi = Math.max(truthPos, ...guesses.map((g) => valueToSlider(g.value) * 100));
  const multi = guesses.length > 1;
  return (
    <div className={'scale' + (compact ? ' compact' : '')} aria-hidden="true">
      <div className="scale-track">
        {!multi && <div className="scale-gap" style={{ left: `${lo}%`, width: `${hi - lo}%` }}></div>}
        {MARKS.map((m) => <span key={m} className="scale-tick" style={{ left: `${valueToSlider(m) * 100}%` }}></span>)}
        {guesses.map((g, i) => (
          <div key={g.label + i} className={'scale-mark mark-guess' + (multi ? ' p' + (i % 8) : '')} style={{ left: `${valueToSlider(g.value) * 100}%` }} title={`${g.label}: ${fmt(g.value)}`}>
            <span>{g.label}</span>
          </div>
        ))}
        <div className="scale-mark mark-truth" style={{ left: `${truthPos}%` }}><span>{t('verdict.truth').toLowerCase()}</span></div>
      </div>
      <div className="scale-labels">
        {MARKS.map((m) => <span key={m} style={{ left: `${valueToSlider(m) * 100}%` }}>{markLabel(m)}</span>)}
      </div>
    </div>
  );
}

export function ReviewLine({ game }) {
  return (
    <div className="review-line">
      <span className="review-label">{t('verdict.allReviews')}</span>
      <span className={'review-desc ' + reviewTone(game)}>{scoreLabel(game)}</span>
      <span className="review-count">({fmt(game.reviews)})</span>
    </div>
  );
}

// The personal verdict: how close you were, in one glance. Used by classic and multiplayer.
export function Verdict({ game, guess, pct, main, bonus, rankLine, noAnswer }) {
  const grade = noAnswer ? 'bad' : gradeOf(main);
  const shown = useCountUp(noAnswer ? 0 : main);
  const shownBonus = useCountUp(noAnswer ? 0 : bonus || 0, 1100);
  const truthPct = positivePct(game);
  return (
    <div className={'verdict ' + grade}>
      <div className="verdict-head">
        <span className="verdict-badge">{noAnswer ? t('verdict.noAnswer') : t('verdict.' + grade)}</span>
        <span className="verdict-points">+{fmt(shown)}</span>
        {!noAnswer && typeof pct === 'number' && game.reviews > 0 && (
          <span className={'verdict-bonus' + (bonus ? ' hit' : '')}>{t('verdict.bonus', { n: fmt(shownBonus) })}</span>
        )}
      </div>
      {rankLine && <div className="verdict-rank">{rankLine}</div>}

      <div className="truth-hero">
        <div className="truth-col">
          <div className="truth-label">{t('verdict.truth')}</div>
          <div className="truth-num">{fmt(game.reviews)}</div>
          <div className="truth-word">{t('reviews', { n: game.reviews })}{game.reviews > 0 ? ` · ${t('verdict.positive', { p: truthPct })}` : ''}</div>
        </div>
        {!noAnswer && (
          <div className="truth-col yours">
            <div className="truth-label">{t('verdict.yours')}</div>
            <div className="truth-num">{fmt(guess)}</div>
            <div className="truth-word">{ratioText(guess, game.reviews)}{typeof pct === 'number' && game.reviews > 0 ? ` · ${pct}%` : ''}</div>
          </div>
        )}
      </div>

      <ReviewLine game={game} />
    </div>
  );
}

export default function RoundResult({ game, result, isLast, onNext }) {
  return (
    <section className="result">
      <Verdict game={game} guess={result.guess} pct={result.pct} main={result.main} bonus={result.bonus} />
      <ScaleBar guesses={[{ label: t('mp.you'), value: result.guess }]} actual={game.reviews} compact />
      <div className="result-actions">
        <a className="btn" href={steamUrl(game)} target="_blank" rel="noreferrer">{t('verdict.openSteam')}</a>
        <button className="btn primary big" onClick={onNext} autoFocus>{isLast ? t('verdict.results') : t('verdict.next')}</button>
      </div>
    </section>
  );
}
