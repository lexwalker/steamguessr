import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt, getLang, t } from '../../lib/i18n.js';
import { MAX_ROUND, ROUNDS, ROUND_TOTAL, positivePct } from '../../lib/scoring.js';
import { loadFlyAssets } from '../../lib/fly/load.js';
import { pickFlyGames, predictFly, readFlyRun, restoreFlyRun, scoreFlyRound, validGuess, writeFlyRun } from '../../lib/fly/match.js';
import GameCard from '../GameCard.jsx';
import GuessSlider from '../GuessSlider.jsx';
import { ScaleBar, Verdict } from '../RoundResult.jsx';
import FlyScene from './FlyScene.jsx';
import './fly.css';

function ModelDetails({ assets }) {
  const { model, metrics } = assets;
  return <details className="howto fly-method">
    <summary>{t('fly.about')}</summary>
    <p>{t('fly.model', { n: fmt(model.nPN + model.nKC + model.nMBON), e: fmt(model.edges1.length + model.edges2.length) })}</p>
    <p>{t('fly.explain')}</p><p>{t('fly.method')}</p>
    <p>{t('fly.audit', { n: fmt(metrics.split.test), score: fmt(metrics.results.fly.score), baseline: fmt(metrics.results.ordinary.score) })}</p>
    <div className="fly-source-links"><a href={`${import.meta.env.BASE_URL}fly/ATTRIBUTION.txt`} target="_blank" rel="noreferrer">{t('fly.sources')}</a><a href={`${import.meta.env.BASE_URL}fly/metrics.json`} download>{t('fly.metrics')}</a></div>
  </details>;
}

function Match({ data, assets, seed, onExit, onReplay }) {
  const key = `${seed}:${data.version}:${assets.signature}`;
  const [initial] = useState(() => restoreFlyRun(readFlyRun(), key, data.games, assets.testIds)
    || { games: pickFlyGames(data.games, assets.testIds, seed), guesses: [], phase: 'play' });
  const games = initial.games;
  const predictions = useMemo(() => games.map((game) => predictFly(game, assets.model)), [games, assets.model]);
  const [guesses, setGuesses] = useState(initial.guesses);
  const [phase, setPhase] = useState(initial.phase);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const results = useMemo(() => guesses.map((guess, i) => scoreFlyRound(games[i], guess, predictions[i])), [games, guesses, predictions]);
  const humanTotal = results.reduce((sum, r) => sum + r.human.score, 0);
  const flyTotal = results.reduce((sum, r) => sum + r.fly.score, 0);
  const round = Math.min(guesses.length - (phase === 'reveal' ? 1 : 0), games.length - 1);
  const game = games[round];
  const prediction = predictions[round];
  const result = phase === 'reveal' ? results.at(-1) : null;

  useEffect(() => {
    if (games.length === ROUNDS) writeFlyRun({ key, ids: games.map((g) => g.id), guesses, phase });
  }, [key, games, guesses, phase]);

  function submit(guess) {
    if (phase !== 'play' || locked.current) return;
    if (!validGuess(guess)) { setError(t('fly.badGuess')); return; }
    locked.current = true;
    setError('');
    setGuesses((previous) => [...previous, { value: guess.value, pct: guess.pct }]);
    setPhase('reveal');
  }

  function next() {
    if (phase !== 'reveal') return;
    locked.current = false;
    setPhase(guesses.length === games.length ? 'summary' : 'play');
  }

  if (games.length < ROUNDS) return <div className="notice"><p>{t('fly.noGames')}</p><button className="btn" onClick={onExit}>{t('game.exit')}</button></div>;

  const totals = <div className="fly-scoreboard" aria-live="polite"><div><span>{t('fly.you')}</span><strong>{fmt(humanTotal)}</strong></div><span aria-hidden="true">:</span><div><span>🪰 {t('fly.opponent')}</span><strong>{fmt(flyTotal)}</strong></div></div>;
  if (phase === 'summary') return <div className="game fly-game">
    <div className="topbar"><span className="crumb">{t('fly.title')}</span><button className="link" onClick={onExit}>{t('game.exit')}</button></div>
    <section className="fly-final">
      <h1>{t(humanTotal > flyTotal ? 'fly.win' : humanTotal < flyTotal ? 'fly.lose' : 'fly.tie')}</h1>{totals}
      <p className="dim">{t('summary.of', { max: fmt(ROUNDS * ROUND_TOTAL) })}</p>
      <div className="fly-table-wrap"><table className="fly-table"><thead><tr><th>{t('fly.game')}</th><th>{t('fly.you')}</th><th>{t('fly.opponent')}</th><th>{t('verdict.truth')}</th></tr></thead><tbody>{results.map((r, i) => <tr key={r.id}><td>{games[i].name}</td><td><b>{fmt(r.human.score)}</b><small>{fmt(r.guess)} · {r.pct}%</small></td><td><b>{fmt(r.fly.score)}</b><small>{fmt(r.fly.guess)} · {r.fly.pct}%</small></td><td><b>{fmt(games[i].reviews)}</b><small>{positivePct(games[i])}%</small></td></tr>)}</tbody></table></div>
      <div className="result-actions"><button className="btn" onClick={onExit}>{t('game.exit')}</button><button className="btn primary big" onClick={onReplay}>{t('fly.again')}</button></div>
    </section><ModelDetails assets={assets} />
  </div>;

  return <div className="game fly-game">
    <div className="topbar"><span className="crumb">{t('fly.title')}</span><div className="pips" aria-label={t('game.round', { i: round + 1, n: games.length })}>{games.map((g, i) => <span key={g.id} className={`pip${i < guesses.length ? ' done' : i === round ? ' current' : ''}`} />)}</div><span>{t('game.round', { i: round + 1, n: games.length })}</span><button className="link" onClick={onExit}>{t('game.exit')}</button></div>
    <div className="fly-intro"><p>{t('fly.rules')}</p>{totals}</div>
    <FlyScene key={getLang()} game={game} prediction={prediction} result={result} />
    <GameCard key={game.id} game={game} revealed={phase === 'reveal'} startWith="image">
      {phase === 'play' ? <><p className="fly-ready">🪰 {t('fly.ready')}</p><GuessSlider key={game.id} maxScore={MAX_ROUND} onSubmit={submit} />{error && <p className="fly-error" role="alert">{error}</p>}</> : <section className="result" aria-live="polite">
        <Verdict game={game} guess={result.guess} pct={result.pct} main={result.human.main} bonus={result.human.bonus} />
        <div className="fly-round-result"><div><b>🪰 {t('fly.opponent')}</b><span>{t('fly.guessFormat', { n: fmt(result.fly.guess), p: result.fly.pct })}</span></div><strong>+{fmt(result.fly.score)}</strong></div>
        <p className="fly-round-verdict">{t(result.human.score > result.fly.score ? 'fly.roundWin' : result.human.score < result.fly.score ? 'fly.roundLose' : 'fly.roundTie')}</p>
        <ScaleBar guesses={[{ label: t('fly.you'), value: result.guess }, { label: t('fly.opponent'), value: result.fly.guess }]} actual={game.reviews} compact />
        <div className="result-actions"><button className="btn primary big" onClick={next} autoFocus>{guesses.length === games.length ? t('verdict.results') : t('verdict.next')}</button></div>
      </section>}
    </GameCard>
    <ModelDetails assets={assets} />
  </div>;
}

export default function FlyGame(props) {
  const [assets, setAssets] = useState(null), [error, setError] = useState(null), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    loadFlyAssets().then((value) => { if (active) setAssets(value); }).catch((e) => { if (active) setError(e); });
    return () => { active = false; };
  }, [attempt]);
  if (error) return <div className="notice"><p role="alert">{t('fly.loadError')}</p><button className="btn primary" onClick={() => setAttempt((x) => x + 1)}>{t('fly.retry')}</button> <button className="btn" onClick={props.onExit}>{t('game.exit')}</button></div>;
  if (!assets) return <div className="notice">{t('fly.loading')}</div>;
  return <Match key={`${props.seed}:${props.data.version}:${assets.signature}`} {...props} assets={assets} />;
}
