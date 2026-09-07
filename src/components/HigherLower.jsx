import { useMemo, useState } from 'react';
import { hiloDeck, steamUrl } from '../lib/data.js';
import { fmt, positivePct, reviewsWord } from '../lib/scoring.js';
import { loadStats, updateStats } from '../lib/storage.js';

function MiniCard({ game, children }) {
  return (
    <div className="mini">
      <img className="mini-img" src={game.img} alt="" />
      <div className="mini-body">
        <h3 className="mini-title">{game.name}</h3>
        <p className="mini-desc">{game.desc}</p>
        <div className="tags small">{game.tags.slice(0, 4).map((t) => <span key={t} className="tag">{t}</span>)}</div>
        <div className="mini-meta">{game.year ? game.year : ''}{game.dev.length ? ` · ${game.dev[0]}` : ''}</div>
        {children}
      </div>
    </div>
  );
}

export default function HigherLower({ data, seed, onExit, onReplay }) {
  const deck = useMemo(() => hiloDeck(data.games, seed), [data, seed]);
  const [i, setI] = useState(0);
  const [streak, setStreak] = useState(0);
  const [state, setState] = useState('play'); // play | reveal | over | won
  const [lastOk, setLastOk] = useState(null);
  const best = loadStats().hiloBest;

  const left = deck[i];
  const right = deck[i + 1];

  if (!left || !right) {
    return <div className="notice">В датасете пока слишком мало игр для этого режима.</div>;
  }

  function choose(higher) {
    if (state !== 'play') return;
    const ok = higher ? right.reviews >= left.reviews : right.reviews <= left.reviews;
    setLastOk(ok);
    setState('reveal');
    setTimeout(() => {
      if (ok) {
        const s = streak + 1;
        setStreak(s);
        updateStats((st) => { if (s > st.hiloBest) st.hiloBest = s; });
        if (i + 2 >= deck.length) setState('won');
        else { setI(i + 1); setState('play'); }
      } else {
        setState('over');
      }
    }, 1100);
  }

  const finished = state === 'over' || state === 'won';

  return (
    <div className="hilo">
      <div className="topbar">
        <span>Больше / Меньше</span>
        <span>Серия: {streak}</span>
        <span>Рекорд: {Math.max(best, streak)}</span>
        <button className="link" onClick={onExit}>Выйти</button>
      </div>

      <div className="hilo-pair">
        <MiniCard game={left}>
          <div className="mini-count"><strong>{fmt(left.reviews)}</strong> {reviewsWord(left.reviews)}</div>
        </MiniCard>

        <div className="vs">vs</div>

        <MiniCard game={right}>
          {state === 'play' ? (
            <div className="hilo-buttons">
              <button className="btn primary" onClick={() => choose(true)}>Больше ▲</button>
              <button className="btn primary" onClick={() => choose(false)}>Меньше ▼</button>
            </div>
          ) : (
            <div className={'mini-count ' + (lastOk ? 'ok' : 'bad')}>
              <strong>{fmt(right.reviews)}</strong> {reviewsWord(right.reviews)} · {positivePct(right)}% {lastOk ? '✓' : '✗'}
            </div>
          )}
        </MiniCard>
      </div>

      {finished && (
        <section className="summary">
          <h2>{state === 'won' ? 'Колода закончилась, ты прошёл её всю!' : 'Серия оборвалась'}</h2>
          <div className="summary-total">
            <span className="summary-points">{streak}</span>
            <span className="summary-max">подряд · рекорд {Math.max(best, streak)}</span>
          </div>
          {state === 'over' && (
            <p className="note">
              <a href={steamUrl(right)} target="_blank" rel="noreferrer">{right.name}</a>: {fmt(right.reviews)} {reviewsWord(right.reviews)}, а у {left.name} было {fmt(left.reviews)}.
            </p>
          )}
          <div className="summary-actions">
            <button className="btn primary big" onClick={onReplay}>Ещё раз</button>
            <button className="btn" onClick={onExit}>На главную</button>
          </div>
        </section>
      )}
    </div>
  );
}
