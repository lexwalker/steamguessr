import { pickGames } from './data.js';
import { randomSeed } from './rng.js';
import { MAX_ROUND, scoreRound } from './scoring.js';

export const MP_LIMITS = { minPlayers: 1, maxPlayers: 8 };
export const REVEAL_PAUSE = 12000;   // ms shown between reveal and the next round
export const OFFLINE_AFTER = 20000;  // ms without a ping before a player counts as away
export const SUBMIT_GRACE = 1500;    // ms after the deadline before the host closes the round

// Host-side game logic. The host owns `state`, publishes it (retained) after every
// change and keeps the current round's guesses private until the reveal.
export function createHost({ code, me, data, publish, onState }) {
  let state = null;
  let guesses = {};
  let games = [];
  const seen = {};
  let roundTimer = 0;
  let nextTimer = 0;

  function emit() {
    state.now = Date.now();
    onState(state);
    publish({ t: 'state', ...state }, true);
  }

  function player(id) {
    return state.players[id];
  }

  function onlineIds() {
    return state.order.filter((id) => state.players[id] && state.players[id].online);
  }

  function init(existing) {
    if (existing && existing.hostId === me.id) {
      state = { ...existing };
      games = state.seed ? pickGames(data.games, state.settings.pool, state.seed, state.settings.rounds) : [];
      if (state.phase === 'round') scheduleReveal();
      if (state.phase === 'reveal') scheduleNext();
      emit();
      return;
    }
    state = {
      v: 1,
      code,
      hostId: me.id,
      phase: 'lobby',
      settings: { pool: 'mix', rounds: 5, timer: 60 },
      players: { [me.id]: { name: me.name, score: 0, online: true } },
      order: [me.id],
      seed: '',
      round: 0,
      deadline: 0,
      nextAt: 0,
      answered: [],
      results: [],
      now: Date.now(),
    };
    emit();
  }

  function setSettings(patch) {
    if (state.phase !== 'lobby') return;
    state.settings = { ...state.settings, ...patch };
    emit();
  }

  function startRound(i) {
    state.round = i;
    state.phase = 'round';
    state.deadline = state.settings.timer ? Date.now() + state.settings.timer * 1000 : 0;
    state.nextAt = 0;
    state.answered = [];
    guesses = {};
    emit();
    scheduleReveal();
  }

  function scheduleReveal() {
    clearTimeout(roundTimer);
    if (!state.deadline) return;
    roundTimer = setTimeout(reveal, Math.max(0, state.deadline - Date.now() + SUBMIT_GRACE));
  }

  function scheduleNext() {
    clearTimeout(nextTimer);
    nextTimer = setTimeout(next, Math.max(0, (state.nextAt || 0) - Date.now()));
  }

  function start() {
    if (state.phase !== 'lobby') return;
    state.seed = randomSeed();
    games = pickGames(data.games, state.settings.pool, state.seed, state.settings.rounds);
    state.settings = { ...state.settings, rounds: games.length };
    state.results = [];
    for (const id of state.order) state.players[id].score = 0;
    startRound(0);
  }

  function reveal() {
    if (state.phase !== 'round') return;
    clearTimeout(roundTimer);
    const game = games[state.round];
    const round = { round: state.round, gameId: game.id, truth: game.reviews, guesses: {} };
    for (const id of state.order) {
      const g = guesses[id];
      if (!g) continue;
      const scored = scoreRound(game, g.value, g.pct, g.max);
      round.guesses[id] = { value: g.value, pct: g.pct, ...scored };
      state.players[id].score += scored.score;
    }
    state.results = [...state.results, round];
    state.phase = 'reveal';
    state.nextAt = Date.now() + REVEAL_PAUSE;
    state.answered = [];
    emit();
    scheduleNext();
  }

  function next() {
    clearTimeout(nextTimer);
    if (state.phase !== 'reveal') return;
    if (state.round + 1 >= state.settings.rounds) {
      state.phase = 'final';
      state.nextAt = 0;
      emit();
      return;
    }
    startRound(state.round + 1);
  }

  function restart() {
    clearTimeout(roundTimer);
    clearTimeout(nextTimer);
    state.phase = 'lobby';
    state.seed = '';
    state.round = 0;
    state.results = [];
    state.answered = [];
    state.deadline = 0;
    state.nextAt = 0;
    for (const id of state.order) state.players[id].score = 0;
    emit();
  }

  function kick(id) {
    if (id === me.id || !state.players[id]) return;
    delete state.players[id];
    state.order = state.order.filter((x) => x !== id);
    emit();
  }

  function maybeCloseRound() {
    if (state.phase !== 'round') return;
    const waiting = onlineIds().filter((id) => !guesses[id]);
    if (waiting.length === 0) reveal();
  }

  function handle(msg) {
    if (!state || !msg || msg.from === me.id) return;
    seen[msg.from] = Date.now();
    switch (msg.t) {
      case 'join': {
        const name = String(msg.name || '').slice(0, 24) || 'Игрок';
        if (player(msg.from)) {
          player(msg.from).online = true;
          player(msg.from).name = name;
        } else if (state.phase === 'lobby' && state.order.length < MP_LIMITS.maxPlayers) {
          state.players[msg.from] = { name, score: 0, online: true };
          state.order = [...state.order, msg.from];
        } else {
          return; // game in progress or lobby full: the client shows itself as a spectator
        }
        emit();
        break;
      }
      case 'leave': {
        if (!player(msg.from)) return;
        if (state.phase === 'lobby') {
          delete state.players[msg.from];
          state.order = state.order.filter((x) => x !== msg.from);
        } else {
          player(msg.from).online = false;
        }
        emit();
        maybeCloseRound();
        break;
      }
      case 'ping': {
        const p = player(msg.from);
        if (p && !p.online) {
          p.online = true;
          emit();
        }
        break;
      }
      case 'guess': {
        if (state.phase !== 'round' || msg.round !== state.round || !player(msg.from) || guesses[msg.from]) return;
        guesses[msg.from] = {
          value: Math.max(0, Math.trunc(Number(msg.value) || 0)),
          pct: typeof msg.pct === 'number' ? Math.min(100, Math.max(0, Math.round(msg.pct))) : null,
          max: Math.min(MAX_ROUND, Math.max(0, Number(msg.max) || MAX_ROUND)),
        };
        state.answered = [...state.answered, msg.from];
        emit();
        maybeCloseRound();
        break;
      }
      default:
        break;
    }
  }

  // The host's own guess goes through the same path without the network.
  function submitOwn(value, pct, max) {
    handle({ t: 'guess', from: '__self__', round: state.round, value, pct, max, _self: true });
  }

  // patch: treat the host itself as a normal sender for its own guess
  const realHandle = handle;
  function handleAny(msg) {
    if (msg && msg._self) {
      const m = { ...msg, from: me.id };
      delete m._self;
      seen[me.id] = Date.now();
      if (state.phase !== 'round' || m.round !== state.round || guesses[me.id]) return;
      guesses[me.id] = { value: Math.max(0, Math.trunc(Number(m.value) || 0)), pct: typeof m.pct === 'number' ? m.pct : null, max: Math.min(MAX_ROUND, Math.max(0, Number(m.max) || MAX_ROUND)) };
      state.answered = [...state.answered, me.id];
      emit();
      maybeCloseRound();
      return;
    }
    realHandle(msg);
  }

  function tick() {
    if (!state) return;
    let changed = false;
    const now = Date.now();
    for (const id of state.order) {
      if (id === me.id) continue;
      const p = state.players[id];
      const last = seen[id] || 0;
      if (p.online && now - last > OFFLINE_AFTER) {
        p.online = false;
        changed = true;
      }
    }
    if (changed) {
      emit();
      maybeCloseRound();
    }
  }

  function stop() {
    clearTimeout(roundTimer);
    clearTimeout(nextTimer);
  }

  return {
    init,
    handle: handleAny,
    submitOwn: (value, pct, max) => handleAny({ t: 'guess', round: state.round, value, pct, max, _self: true }),
    setSettings,
    start,
    next,
    restart,
    kick,
    tick,
    stop,
    get games() { return games; },
    get state() { return state; },
  };
}

// Colours for player markers, by position in the lobby order.
export const PLAYER_COLORS = ['#66c0f4', '#a4d007', '#ff6b57', '#e5c07b', '#c678dd', '#56b6c2', '#ff9f43', '#f2f2f2'];
