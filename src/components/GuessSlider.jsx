import { useEffect, useRef, useState } from 'react';
import { sliderToValue, valueToSlider, TONE_COLORS, MAX_BONUS } from '../lib/scoring.js';
import { fmt, fmtCompact, ratingTier, t } from '../lib/i18n.js';

export const MARKS = [10, 100, 1000, 10000, 100000, 1000000];

// "10K", "1M" in English, "10 тыс.", "1 млн" in Russian, "1万", "100万" in Chinese and Japanese.
export function markLabel(m) {
  return fmtCompact(m);
}

// The answer panel: two clearly separate questions (review count, Steam rating)
// and one big button. `deadline` (ms, local clock) makes the panel submit itself
// when time runs out.
export default function GuessSlider({ maxScore, onSubmit, deadline, showBonus = true }) {
  const [pos0, setPos0] = useState(valueToSlider(1000));
  const [typed, setTyped] = useState('');
  const [pct, setPct] = useState(80);

  const value = typed !== '' ? Number(typed.replace(/\D/g, '')) || 0 : sliderToValue(pos0);
  const pos = typed !== '' ? valueToSlider(value) : pos0;
  const tier = ratingTier(pct);

  const latest = useRef({ value, pct });
  latest.current = { value, pct };

  useEffect(() => {
    if (!deadline) return undefined;
    const ms = deadline - Date.now();
    const id = setTimeout(() => onSubmit({ value: latest.current.value, pct: showBonus ? latest.current.pct : null, auto: true }), Math.max(0, ms));
    return () => clearTimeout(id);
  }, [deadline, onSubmit, showBonus]);

  function submit(e) {
    e.preventDefault();
    onSubmit({ value, pct: showBonus ? pct : null, auto: false });
  }

  return (
    <form className="guess" onSubmit={submit}>
      <div className="q q1">
        <div className="q-head">
          <span className="q-step">1</span>
          <span className="q-title">{t('guess.q1')}</span>
          <span className="q-max">{t('guess.upTo', { n: fmt(maxScore) })}</span>
        </div>
        <div className="guess-value">
          <span className="guess-num">{fmt(value)}</span>
          <span className="guess-word">{t('reviews', { n: value })}</span>
        </div>
        <div className="slider-wrap">
          <input
            className="slider"
            type="range"
            min="0"
            max="1000"
            value={Math.round(pos * 1000)}
            style={{ '--fill': `${pos * 100}%` }}
            onChange={(e) => { setTyped(''); setPos0(Number(e.target.value) / 1000); }}
          />
          <div className="ticks" aria-hidden="true">
            {MARKS.map((m) => <span key={m} className="tick" style={{ left: `${valueToSlider(m) * 100}%` }}></span>)}
          </div>
          <div className="marks">
            {MARKS.map((m) => (
              <button key={m} type="button" className="mark" style={{ left: `${valueToSlider(m) * 100}%` }} onClick={() => { setTyped(''); setPos0(valueToSlider(m)); }}>
                {markLabel(m)}
              </button>
            ))}
          </div>
        </div>
        <input
          className="typed"
          inputMode="numeric"
          placeholder={t('guess.typed')}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </div>

      {showBonus && (
        <div className="q q2">
          <div className="q-head">
            <span className="q-step">2</span>
            <span className="q-title">{t('guess.q2')}</span>
            <span className="q-max">{t('guess.bonusUpTo', { n: fmt(MAX_BONUS) })}</span>
          </div>
          <div className="pct-row">
            <span className={'pct-tier ' + tier.tone}>{t('tier.' + tier.id)}</span>
            <span className="pct-value">{pct}%</span>
          </div>
          <input
            className="slider pct"
            type="range"
            min="0"
            max="100"
            value={pct}
            style={{ '--fill': `${pct}%`, '--fill-color': TONE_COLORS[tier.tone] }}
            onChange={(e) => setPct(Number(e.target.value))}
          />
          <div className="bonus-scale"><span>{t('guess.neg')}</span><span>{t('guess.mixed')}</span><span>{t('guess.pos')}</span></div>
        </div>
      )}

      <button type="submit" className="btn primary big wide">{t('guess.submit')}</button>
    </form>
  );
}
