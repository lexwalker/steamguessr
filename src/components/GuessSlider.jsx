import { useState } from 'react';
import { fmt, sliderToValue, valueToSlider, reviewsWord } from '../lib/scoring.js';

const MARKS = [10, 100, 1000, 10000, 100000, 1000000];

export default function GuessSlider({ maxScore, onSubmit }) {
  const [t, setT] = useState(valueToSlider(1000));
  const [typed, setTyped] = useState('');

  const value = typed !== '' ? Number(typed.replace(/\D/g, '')) || 0 : sliderToValue(t);

  function submit(e) {
    e.preventDefault();
    onSubmit(value);
  }

  return (
    <form className="guess" onSubmit={submit}>
      <div className="guess-value">
        <span className="guess-num">{fmt(value)}</span> {reviewsWord(value)}
        <span className="guess-max">максимум за раунд: {fmt(maxScore)}</span>
      </div>
      <input
        className="slider"
        type="range"
        min="0"
        max="1000"
        value={typed !== '' ? Math.round(valueToSlider(value) * 1000) : Math.round(t * 1000)}
        onChange={(e) => { setTyped(''); setT(Number(e.target.value) / 1000); }}
      />
      <div className="marks">
        {MARKS.map((m) => (
          <button key={m} type="button" className="mark" style={{ left: `${valueToSlider(m) * 100}%` }} onClick={() => { setTyped(''); setT(valueToSlider(m)); }}>
            {m >= 1000000 ? m / 1000000 + ' млн' : m >= 1000 ? m / 1000 + ' тыс' : m}
          </button>
        ))}
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
