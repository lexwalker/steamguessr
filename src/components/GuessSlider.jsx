import { useEffect, useRef, useState } from 'react';
import { fmt, sliderToValue, valueToSlider, reviewsWord, ratingTier, TONE_COLORS, MAX_BONUS } from '../lib/scoring.js';

export const MARKS = [10, 100, 1000, 10000, 100000, 1000000];

export function markLabel(m) {
  if (m >= 1000000) return m / 1000000 + ' млн';
  if (m >= 1000) return m / 1000 + ' тыс';
  return String(m);
}

// The answer panel: two clearly separate questions (review count, Steam rating)
// and one big button. `deadline` (ms, local clock) makes the panel submit itself
// when time runs out.
export default function GuessSlider({ maxScore, onSubmit, deadline, showBonus = true }) {
  const [t, setT] = useState(valueToSlider(1000));
  const [typed, setTyped] = useState('');
  const [pct, setPct] = useState(80);

  const value = typed !== '' ? Number(typed.replace(/\D/g, '')) || 0 : sliderToValue(t);
  const pos = typed !== '' ? valueToSlider(value) : t;
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
          <span className="q-title">Сколько отзывов у игры в Steam?</span>
          <span className="q-max">до {fmt(maxScore)} очков</span>
        </div>
        <div className="guess-value">
          <span className="guess-num">{fmt(value)}</span>
          <span className="guess-word">{reviewsWord(value)}</span>
        </div>
        <div className="slider-wrap">
          <input
            className="slider"
            type="range"
            min="0"
            max="1000"
            value={Math.round(pos * 1000)}
            style={{ '--fill': `${pos * 100}%` }}
            onChange={(e) => { setTyped(''); setT(Number(e.target.value) / 1000); }}
          />
          <div className="ticks" aria-hidden="true">
            {MARKS.map((m) => <span key={m} className="tick" style={{ left: `${valueToSlider(m) * 100}%` }}></span>)}
          </div>
          <div className="marks">
            {MARKS.map((m) => (
              <button key={m} type="button" className="mark" style={{ left: `${valueToSlider(m) * 100}%` }} onClick={() => { setTyped(''); setT(valueToSlider(m)); }}>
                {markLabel(m)}
              </button>
            ))}
          </div>
        </div>
        <input
          className="typed"
          inputMode="numeric"
          placeholder="или введи число отзывов"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </div>

      {showBonus && (
        <div className="q q2">
          <div className="q-head">
            <span className="q-step">2</span>
            <span className="q-title">Какая у неё оценка?</span>
            <span className="q-max">бонус до {fmt(MAX_BONUS)}</span>
          </div>
          <div className="pct-row">
            <span className={'pct-tier ' + tier.tone}>{tier.name}</span>
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
          <div className="bonus-scale"><span>отрицательные</span><span>смешанные</span><span>положительные</span></div>
        </div>
      )}

      <button type="submit" className="btn primary big wide">Ответить</button>
    </form>
  );
}
