import { rngFromSeed, seededShuffle } from '../rng.js';
import { predict } from './network.js';
import { MAX_ROUND, ROUNDS, scoreRound } from '../scoring.js';

export const FLY_RUN_KEY = 'steamguessr-fly-run-v1';
const INPUT_FIELDS = ['tags', 'year', 'price', 'dev', 'pub', 'platforms', 'meta', 'dlc', 'ach'];

export function flyInput(game) {
  return Object.fromEntries(INPUT_FIELDS.map((key) => [key, game[key]]));
}

export function predictFly(game, model) {
  return predict(flyInput(game), model);
}

export function pickFlyGames(games, testIds, seed) {
  const allowed = new Set(testIds);
  const unique = [...new Map(games.filter((g) => allowed.has(g.id)).map((g) => [g.id, g])).values()];
  if (unique.length < ROUNDS) return [];
  return seededShuffle(unique, rngFromSeed(seed)).slice(0, ROUNDS);
}

export function validGuess({ value, pct } = {}) {
  return Number.isSafeInteger(value) && value >= 0 && Number.isInteger(pct) && pct >= 0 && pct <= 100;
}

export function scoreFlyRound(game, guess, prediction) {
  if (!validGuess(guess)) throw new Error('Invalid guess');
  return { id: game.id, guess: guess.value, pct: guess.pct,
    human: scoreRound(game, guess.value, guess.pct, MAX_ROUND),
    fly: { guess: prediction.reviews, pct: prediction.pct, ...scoreRound(game, prediction.reviews, prediction.pct, MAX_ROUND) } };
}

export function restoreFlyRun(stored, key, games, testIds) {
  if (!stored || stored.key !== key || !Array.isArray(stored.ids) || stored.ids.length !== ROUNDS || new Set(stored.ids).size !== ROUNDS) return null;
  const allowed = new Set(testIds), byId = new Map(games.map((g) => [g.id, g]));
  if (!stored.ids.every((id) => allowed.has(id) && byId.has(id))) return null;
  if (!Array.isArray(stored.guesses) || stored.guesses.length > ROUNDS || !stored.guesses.every(validGuess)) return null;
  const count = stored.guesses.length;
  const phase = count === ROUNDS ? (stored.phase === 'summary' ? 'summary' : 'reveal') : count && stored.phase === 'reveal' ? 'reveal' : 'play';
  return { games: stored.ids.map((id) => byId.get(id)), guesses: stored.guesses, phase };
}

export function readFlyRun() {
  try { return JSON.parse(localStorage.getItem(FLY_RUN_KEY) || 'null'); } catch { return null; }
}

export function writeFlyRun(run) {
  try { localStorage.setItem(FLY_RUN_KEY, JSON.stringify(run)); } catch { /* storage is optional */ }
}
