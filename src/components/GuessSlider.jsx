import { useState } from 'react';
import { fmt, sliderToValue, valueToSlider, reviewsWord } from '../lib/scoring.js';

export const MARKS = [10, 100, 1000, 10000, 100000, 1000000];

export function markLabel(m) {
  if (m >= 1000000) return m / 1000000 + ' млн';
  if (m >= 1000) return m / 1000 + ' тыс';
  return String(m);
}

export default function GuessSlider({ maxScore, onSubmit }) {
  const [t, setT] = useState(valueToSlider(1000));
  const [typed, setTyped] = useState('');

  const value = typed !== '' ? Number(typed.replace(/\D/g, '')) || 0 : sliderToValue(t);
  const pos = typed !== '' ? valueToSlider(value) : t;

  function submit(e) {
    e.preventDefault();
    onSubmit(value);
  }

  return (
    <form className="guess" onSubmit={submit}>
      <div className="guess-value">
        <span className="guess-num">{fmt(value)}</span>
        <span className="guess-word">{reviewsWord(value)}</span>
        <span className="guess-max">максимум за раунд: {fmt(maxScore)}</span>
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
      <div className="guess-row">
        <input
          className="typed"
          inputMode="numeric"
          placeholder="или введи число"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button type="submit" className="btn primary big">Ответить</button>
      </div>
    </form>
  );
}
