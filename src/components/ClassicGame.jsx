import { useEffect, useMemo, useState } from 'react';
import { pickGames } from '../lib/data.js';
import { ROUNDS, MAX_ROUND, scoreRound, scoreEmoji, poolLabel } from '../lib/scoring.js';
import { fmt, t } from '../lib/i18n.js';
import { loadStats, updateStats, bumpStreak, addXp } from '../lib/storage.js';
import { checkCalibration, checkGame, checkStreak, dailyGrade, recordRound, toast, xpFor } from '../lib/progress.js';
import { todayKey } from '../lib/rng.js';
import GameCard from './GameCard.jsx';
import GuessSlider from './GuessSlider.jsx';
import RoundResult from './RoundResult.jsx';
import Summary from './Summary.jsx';
import HowTo from './HowTo.jsx';
import TimerBar from './TimerBar.jsx';

// A finished daily / weekly is restored from storage. The stored rounds carry game ids, so the
// summary shows the games that were actually played even if today's set changed since.
function restore(stored, games, all) {
  if (!stored || !Array.isArray(stored.rounds) || !stored.rounds.length) return null;
  if (stored.rounds.length === games.length && stored.rounds.every((r, i) => r.id === games[i].id)) return { results: stored.rounds, games };
  const byId = new Map(all.map((g) => [g.id, g]));
  const played = stored.rounds.map((r) => byId.get(r.id));
  return played.every(Boolean) ? { results: stored.rounds, games: played } : null;
}

export default function ClassicGame({ data, seed, pool, daily, weekly, rounds = ROUNDS, timer = 0, onExit, onReplay }) {
  const picked = useMemo(() => pickGames(data.games, pool, seed, rounds), [data, pool, seed, rounds]);
  const dateKey = daily ? seed.replace(/^daily-/, '') : null;
  const wKey = weekly ? seed.replace(/^weekly-/, '') : null;
  const stored = daily ? loadStats().daily[dateKey] : weekly ? loadStats().weekly[wKey] : null;
  const restored = useMemo(() => restore(stored, picked, data.games), [stored, picked, data]);
  const games = restored ? restored.games : picked;

  const [results, setResults] = useState(restored ? restored.results : []);
  const [phase, setPhase] = useState(restored ? 'summary' : 'play'); // play | reveal | summary
  const [finish, setFinish] = useState(restored ? { xp: stored.xp, grade: stored.grade, unlocked: [] } : null);
  const [deadline, setDeadline] = useState(0);

  const round = phase === 'summary' ? games.length : Math.min(results.length - (phase === 'reveal' ? 1 : 0), games.length - 1);
  const game = games[round];
  const total = results.reduce((s, r) => s + r.score, 0);

  useEffect(() => {
    if (timer && phase === 'play') setDeadline(Date.now() + timer * 1000);
  }, [timer, phase, round]);

  function submit({ value, pct }) {
    const scored = scoreRound(game, value, pct, MAX_ROUND);
    setResults([...results, { id: game.id, guess: value, pct, ...scored }]);
    setPhase('reveal');
  }

  function next() {
    if (results.length >= games.length) {
      const date = todayKey();
      const grid = results.map((r) => scoreEmoji(r.main)).join('');
      const info = { xp: 0, grade: null, unlocked: [] };
      updateStats((s) => {
        s.classicGames += 1;
        if (total > s.classicBest) s.classicBest = total;
        const mode = daily ? 'daily' : weekly ? 'weekly' : 'classic';
        for (const r of results) recordRound(s, { guess: r.guess, game: games.find((g) => g.id === r.id), pool, mode, date });
        if (daily) {
          info.grade = dailyGrade(total);
          bumpStreak(s, dateKey);
          s.dailyPlayed += 1;
          info.xp = xpFor('daily', total, s.streak.count);
          s.daily[dateKey] = { score: total, grid, rounds: results, grade: info.grade, xp: info.xp };
          info.unlocked.push(...checkStreak(s, date));
        } else if (weekly) {
          info.xp = xpFor('weekly', total);
          s.weekly[wKey] = { score: total, grid, rounds: results, xp: info.xp };
        } else {
          info.xp = xpFor('classic', total);
        }
        addXp(s, info.xp);
        info.unlocked.push(...checkGame(s, { results, games, daily, weekly, grade: info.grade, date }));
        info.unlocked.push(...checkCalibration(s, date));
      });
      for (const id of info.unlocked) toast({ type: 'ach', id });
      setFinish(info);
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
      <Summary games={games} results={results} total={total} daily={daily} weekly={weekly} dateKey={dateKey} weekKey={wKey} pool={pool} finish={finish} onExit={onExit} onReplay={onReplay} />
    );
  }

  const roundLabel = t('game.round', { i: round + 1, n: games.length });
  return (
    <div className="game">
      <div className="topbar">
        <span className="crumb">{daily ? t('game.daily') : weekly ? t('game.weekly') : poolLabel(pool)}</span>
        <div className="pips" aria-label={roundLabel}>
          {games.map((g, i) => (
            <span key={g.id} className={'pip' + (i < results.length ? ' done' : i === round ? ' current' : '')}></span>
          ))}
        </div>
        <span>{roundLabel}</span>
        {timer > 0 && phase === 'play' && deadline > 0 && <TimerBar deadline={deadline} total={timer} />}
        <span className="topbar-score">{t('game.score')} <strong>{fmt(total)}</strong></span>
        <button className="link" onClick={onExit}>{t('game.exit')}</button>
      </div>
      {round === 0 && phase === 'play' && !timer && <HowTo />}
      <GameCard key={'card-' + game.id} game={game} revealed={phase === 'reveal'}>
        {phase === 'play'
          ? <GuessSlider key={'guess-' + game.id} maxScore={MAX_ROUND} deadline={timer > 0 && deadline > 0 ? deadline : undefined} onSubmit={submit} />
          : <RoundResult key={'result-' + game.id} game={game} result={results[results.length - 1]} isLast={results.length >= games.length} onNext={next} />}
      </GameCard>
    </div>
  );
}
