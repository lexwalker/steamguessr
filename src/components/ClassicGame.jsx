import { useMemo, useState } from 'react';
import { pickGames } from '../lib/data.js';
import { ROUNDS, MAX_ROUND, fmt, hintCost, roundScore, scoreEmoji, poolLabel } from '../lib/scoring.js';
import { loadStats, updateStats } from '../lib/storage.js';
import GameCard from './GameCard.jsx';
import GuessSlider from './GuessSlider.jsx';
import RoundResult from './RoundResult.jsx';
import Summary from './Summary.jsx';

export default function ClassicGame({ data, seed, pool, daily, onExit, onReplay }) {
  const games = useMemo(() => pickGames(data.games, pool, seed, ROUNDS), [data, pool, seed]);
  const dateKey = daily ? seed.replace(/^daily-/, '') : null;
  const stored = daily ? loadStats().daily[dateKey] : null;
  // A finished daily is restored from storage: same seed and dataset give the same games.
  const restored = stored && stored.rounds && stored.rounds.length === games.length ? stored.rounds : null;

  const [results, setResults] = useState(restored || []);
  const [phase, setPhase] = useState(restored ? 'summary' : 'play'); // play | reveal | summary
  const [hints, setHints] = useState([]);

  const round = phase === 'summary' ? games.length : Math.min(results.length - (phase === 'reveal' ? 1 : 0), games.length - 1);
  const game = games[round];
  const total = results.reduce((s, r) => s + r.score, 0);
  const maxScore = MAX_ROUND - hintCost(hints);

  function submit(guess) {
    const score = roundScore(guess, game.reviews, maxScore);
    setResults([...results, { id: game.id, guess, score, hints, max: maxScore }]);
    setPhase('reveal');
  }

  function next() {
    if (results.length >= games.length) {
      updateStats((s) => {
        s.classicGames += 1;
        if (total > s.classicBest) s.classicBest = total;
        if (daily) s.daily[dateKey] = { score: total, grid: results.map((r) => scoreEmoji(r.score)).join(''), rounds: results };
      });
      setPhase('summary');
      return;
    }
    setHints([]);
    setPhase('play');
  }

  if (games.length === 0) {
    return <div className="notice">В датасете пока нет игр для этого режима.</div>;
  }

  if (phase === 'summary') {
    return (
      <Summary games={games} results={results} total={total} daily={daily} dateKey={dateKey} pool={pool} onExit={onExit} onReplay={onReplay} />
    );
  }

  return (
    <div className="game">
      <div className="topbar">
        <span className="crumb">{daily ? 'Дейли' : poolLabel(pool)}</span>
        <div className="pips" aria-label={`Раунд ${round + 1} из ${games.length}`}>
          {games.map((g, i) => (
            <span key={g.id} className={'pip' + (i < results.length ? ' done' : i === round ? ' current' : '')}></span>
          ))}
        </div>
        <span>Раунд {round + 1} из {games.length}</span>
        <span className="topbar-score">Очки: <strong>{fmt(total)}</strong></span>
        <button className="link" onClick={onExit}>Выйти</button>
      </div>
      <GameCard key={game.id} game={game} hints={hints} onHint={(id) => setHints([...hints, id])} revealed={phase === 'reveal'} />
      {phase === 'play'
        ? <GuessSlider key={game.id} maxScore={maxScore} onSubmit={submit} />
        : <RoundResult key={game.id} game={game} result={results[results.length - 1]} isLast={results.length >= games.length} onNext={next} />}
    </div>
  );
}
