import { useMemo, useState } from 'react';
import { pickGames } from '../lib/data.js';
import { ROUNDS, MAX_ROUND, scoreRound, scoreEmoji, poolLabel } from '../lib/scoring.js';
import { fmt, t } from '../lib/i18n.js';
import { loadStats, updateStats, bumpStreak } from '../lib/storage.js';
import GameCard from './GameCard.jsx';
import GuessSlider from './GuessSlider.jsx';
import RoundResult from './RoundResult.jsx';
import Summary from './Summary.jsx';
import HowTo from './HowTo.jsx';

export default function ClassicGame({ data, seed, pool, daily, onExit, onReplay }) {
  const games = useMemo(() => pickGames(data.games, pool, seed, ROUNDS), [data, pool, seed]);
  const dateKey = daily ? seed.replace(/^daily-/, '') : null;
  const stored = daily ? loadStats().daily[dateKey] : null;
  // A finished daily is restored from storage: same seed and dataset give the same games.
  const restored = stored && stored.rounds && stored.rounds.length === games.length ? stored.rounds : null;

  const [results, setResults] = useState(restored || []);
  const [phase, setPhase] = useState(restored ? 'summary' : 'play'); // play | reveal | summary

  const round = phase === 'summary' ? games.length : Math.min(results.length - (phase === 'reveal' ? 1 : 0), games.length - 1);
  const game = games[round];
  const total = results.reduce((s, r) => s + r.score, 0);

  function submit({ value, pct }) {
    const scored = scoreRound(game, value, pct, MAX_ROUND);
    setResults([...results, { id: game.id, guess: value, pct, ...scored }]);
    setPhase('reveal');
  }

  function next() {
    if (results.length >= games.length) {
      updateStats((s) => {
        s.classicGames += 1;
        if (total > s.classicBest) s.classicBest = total;
        if (daily) {
          s.daily[dateKey] = { score: total, grid: results.map((r) => scoreEmoji(r.main)).join(''), rounds: results };
          bumpStreak(s, dateKey);
        }
      });
      setPhase('summary');
      return;
    }
    setPhase('play');
  }

  if (games.length === 0) {
    return <div className="notice">{t('game.noGames')}</div>;
  }

  if (phase === 'summary') {
    return (
      <Summary games={games} results={results} total={total} daily={daily} dateKey={dateKey} pool={pool} onExit={onExit} onReplay={onReplay} />
    );
  }

  const roundLabel = t('game.round', { i: round + 1, n: games.length });
  return (
    <div className="game">
      <div className="topbar">
        <span className="crumb">{daily ? t('game.daily') : poolLabel(pool)}</span>
        <div className="pips" aria-label={roundLabel}>
          {games.map((g, i) => (
            <span key={g.id} className={'pip' + (i < results.length ? ' done' : i === round ? ' current' : '')}></span>
          ))}
        </div>
        <span>{roundLabel}</span>
        <span className="topbar-score">{t('game.score')} <strong>{fmt(total)}</strong></span>
        <button className="link" onClick={onExit}>{t('game.exit')}</button>
      </div>
      {round === 0 && phase === 'play' && <HowTo />}
      <GameCard key={'card-' + game.id} game={game} revealed={phase === 'reveal'}>
        {phase === 'play'
          ? <GuessSlider key={'guess-' + game.id} maxScore={MAX_ROUND} onSubmit={submit} />
          : <RoundResult key={'result-' + game.id} game={game} result={results[results.length - 1]} isLast={results.length >= games.length} onNext={next} />}
      </GameCard>
    </div>
  );
}
