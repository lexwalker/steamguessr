import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pickGames, steamUrl } from '../lib/data.js';
import { openChannel, makeLobbyCode } from '../lib/net.js';
import { createHost, PLAYER_COLORS, MP_LIMITS } from '../lib/mp.js';
import { POOLS, MAX_ROUND, fmt, hintCost, positivePct, poolLabel } from '../lib/scoring.js';
import { playerIdentity, savePlayerName } from '../lib/storage.js';
import GameCard from './GameCard.jsx';
import GuessSlider from './GuessSlider.jsx';
import { ScaleBar, Verdict } from './RoundResult.jsx';
import HowTo from './HowTo.jsx';

const ROUND_OPTIONS = [3, 5, 10];
const TIMER_OPTIONS = [10, 15, 20, 30];

function lobbyLink(code) {
  return `${location.origin}${location.pathname}?mode=mp&lobby=${code}`;
}

// ------------------------------------------------------------ entry screen

function Entry({ initialCode, onCreate, onJoin }) {
  const ident = useMemo(() => playerIdentity(), []);
  const [name, setName] = useState(ident.name);
  const [code, setCode] = useState(initialCode || '');
  const nameOk = name.trim().length > 0;

  function go(fn) {
    const n = name.trim().slice(0, 24);
    savePlayerName(n);
    fn(n);
  }

  return (
    <section className="mp-entry">
      <h2>Играть вместе</h2>
      <p className="note">Как в GeoGuessr: одно лобби, одна игра на всех, общий таймер. Когда все ответили или время вышло, появляется сравнение с правдой.</p>
      <label className="field">
        <span>Твоё имя</span>
        <input className="typed" maxLength={24} value={name} placeholder="как тебя показывать" onChange={(e) => setName(e.target.value)} />
      </label>
      {initialCode ? (
        <button className="btn primary big" disabled={!nameOk} onClick={() => go((n) => onJoin(code.toUpperCase(), n))}>Войти в лобби {initialCode}</button>
      ) : (
        <div className="mp-entry-actions">
          <button className="btn primary big" disabled={!nameOk} onClick={() => go((n) => onCreate(n))}>Создать лобби</button>
          <div className="mp-join">
            <input className="typed code" maxLength={5} placeholder="КОД" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
            <button className="btn" disabled={!nameOk || code.length !== 5} onClick={() => go((n) => onJoin(code, n))}>Войти по коду</button>
          </div>
        </div>
      )}
    </section>
  );
}

// ----------------------------------------------------------------- pieces

function TimerBar({ deadline, offset, total }) {
  const [left, setLeft] = useState(() => Math.max(0, deadline - offset - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, deadline - offset - Date.now())), 250);
    return () => clearInterval(id);
  }, [deadline, offset]);
  const secs = Math.ceil(left / 1000);
  const frac = total ? Math.min(1, left / (total * 1000)) : 1;
  return (
    <div className={'timer' + (secs <= 5 ? ' low' : '')}>
      <div className="timer-track"><div className="timer-fill" style={{ width: `${frac * 100}%` }}></div></div>
      <span className="timer-text">{secs} с</span>
    </div>
  );
}

function Countdown({ at, offset }) {
  const [left, setLeft] = useState(() => Math.max(0, at - offset - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, at - offset - Date.now())), 250);
    return () => clearInterval(id);
  }, [at, offset]);
  return <span>{Math.ceil(left / 1000)} с</span>;
}

function PlayerName({ state, id }) {
  const idx = state.order.indexOf(id);
  const p = state.players[id];
  return (
    <span className="pname">
      <span className="pcolor" style={{ background: PLAYER_COLORS[idx % PLAYER_COLORS.length] }}></span>
      {p ? p.name : '…'}
      {p && !p.online && <span className="dim"> · нет связи</span>}
    </span>
  );
}

function Lobby({ state, me, isHost, host, status }) {
  const [copied, setCopied] = useState(false);
  const link = lobbyLink(state.code);
  function copyLink() {
    try {
      navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
    } catch { /* ignore */ }
  }
  const tagPools = POOLS.filter((p) => p.byTag);
  const basePools = POOLS.filter((p) => !p.byTag);

  return (
    <section className="mp-lobby">
      <div className="mp-lobby-head">
        <div>
          <div className="crumb">Код лобби</div>
          <div className="mp-code">{state.code}</div>
        </div>
        <div className="mp-lobby-actions">
          <button className="btn" onClick={copyLink}>{copied ? 'Скопировано!' : 'Скопировать ссылку'}</button>
          <span className="dim">{status === 'connected' ? 'связь есть' : status === 'reconnecting' ? 'переподключение…' : status}</span>
        </div>
      </div>

      <div className="mp-lobby-grid">
        <div>
          <div className="crumb">Игроки · {state.order.length} из {MP_LIMITS.maxPlayers}</div>
          <div className="players">
            {state.order.map((id) => (
              <div key={id} className="player">
                <span className={'dot' + (state.players[id].online ? '' : ' off')}></span>
                <PlayerName state={state} id={id} />
                {id === state.hostId && <span className="dim">хост</span>}
                {id === me.id && <span className="dim">ты</span>}
                {isHost && id !== me.id && <button className="link small" onClick={() => host.kick(id)}>выгнать</button>}
              </div>
            ))}
          </div>
        </div>

        <div className="mp-settings">
          <div className="crumb">Настройки {isHost ? '' : '(меняет хост)'}</div>
          <div className="setting">
            <span>Пул</span>
            <div className="chips">
              {basePools.map((p) => (
                <button key={p.id} className={'chip' + (state.settings.pool === p.id ? ' active' : '')} disabled={!isHost} onClick={() => host.setSettings({ pool: p.id })}>{p.label}</button>
              ))}
            </div>
            <div className="chips">
              {tagPools.map((p) => (
                <button key={p.id} className={'chip' + (state.settings.pool === p.id ? ' active' : '')} disabled={!isHost} onClick={() => host.setSettings({ pool: p.id })}>{p.label}</button>
              ))}
            </div>
          </div>
          <div className="setting">
            <span>Раундов</span>
            <div className="chips">
              {ROUND_OPTIONS.map((n) => (
                <button key={n} className={'chip' + (state.settings.rounds === n ? ' active' : '')} disabled={!isHost} onClick={() => host.setSettings({ rounds: n })}>{n}</button>
              ))}
            </div>
          </div>
          <div className="setting">
            <span>Время на ответ</span>
            <div className="chips">
              {TIMER_OPTIONS.map((n) => (
                <button key={n} className={'chip' + (state.settings.timer === n ? ' active' : '')} disabled={!isHost} onClick={() => host.setSettings({ timer: n })}>{n} с</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="summary-actions">
        {isHost
          ? <button className="btn primary big" disabled={state.order.length < MP_LIMITS.minPlayers} onClick={() => host.start()}>Начать игру</button>
          : <span className="note">Ждём, пока хост начнёт. Пока можно отправить ссылку остальным.</span>}
      </div>
    </section>
  );
}

function RoundView({ state, me, games, offset, answered, myGuess, onSubmit, hints, onHint }) {
  const game = games[state.round];
  if (!game) return <div className="notice">Игра не найдена в датасете. Обнови страницу.</div>;
  const maxScore = MAX_ROUND - hintCost(hints);
  const localDeadline = state.deadline ? state.deadline - offset : 0;
  const waitingFor = state.order.filter((id) => state.players[id].online && !state.answered.includes(id));
  return (
    <div className="game">
      <div className="topbar">
        <span className="crumb">Раунд {state.round + 1} из {state.settings.rounds}</span>
        {state.deadline ? <TimerBar deadline={state.deadline} offset={offset} total={state.settings.timer} /> : null}
        <span className="dim">ответили {state.answered.length} из {state.order.filter((id) => state.players[id].online).length}</span>
      </div>
      {state.round === 0 && <HowTo multiplayer />}
      <GameCard key={'card-' + game.id} game={game} hints={hints} onHint={onHint} revealed={false}>
        {answered ? (
          <section className="waiting">
            <div className="waiting-title">Ответ принят</div>
            {myGuess && <div className="waiting-mine">Твой ответ: <b>{fmt(myGuess.value)}</b>{typeof myGuess.pct === 'number' ? ` · ${myGuess.pct}%` : ''}</div>}
            <div className="note">
              {waitingFor.length
                ? <>Ждём: {waitingFor.map((id) => state.players[id].name).join(', ')}</>
                : 'Все ответили, считаем…'}
            </div>
          </section>
        ) : (
          <GuessSlider key={'guess-' + game.id} maxScore={maxScore} deadline={localDeadline || undefined} onSubmit={(g) => onSubmit(g, maxScore)} />
        )}
      </GameCard>
    </div>
  );
}

function RevealView({ state, me, games, data, offset, isHost, host, isLast }) {
  const result = state.results[state.results.length - 1];
  const game = games[result.round] && games[result.round].id === result.gameId ? games[result.round] : data.games.find((g) => g.id === result.gameId);
  const rows = state.order
    .map((id) => ({ id, name: state.players[id].name, g: result.guesses[id], total: state.players[id].score, idx: state.order.indexOf(id) }))
    .sort((a, b) => ((b.g && b.g.score) || 0) - ((a.g && a.g.score) || 0));
  const mine = result.guesses[me.id];
  const guesses = state.order.filter((id) => result.guesses[id]).map((id) => ({ label: state.players[id].name, value: result.guesses[id].value }));
  const ranked = rows.filter((r) => r.g);
  const myRank = ranked.findIndex((r) => r.id === me.id);
  const best = ranked[0];
  let rankLine = '';
  if (mine && best) {
    if (myRank === 0) rankLine = ranked.length > 1 ? 'Ты ближе всех в этом раунде!' : '';
    else rankLine = `${myRank + 1}-е место в раунде. Ближе всех ${best.name}: ${fmt(best.g.value)}.`;
  } else if (best) {
    rankLine = `Ближе всех ${best.name}: ${fmt(best.g.value)}.`;
  }
  if (!game) return <div className="notice">Игра не найдена в датасете.</div>;
  return (
    <div className="game">
      <div className="topbar">
        <span className="crumb">Раунд {state.round + 1} из {state.settings.rounds} · ответ</span>
        <span className="dim">{isLast ? 'итоги' : 'следующий раунд'} через <Countdown at={state.nextAt} offset={offset} /></span>
        {isHost && <button className="link" onClick={() => host.next()}>{isLast ? 'К итогам' : 'Дальше сейчас'}</button>}
      </div>
      <GameCard key={'card-' + game.id} game={game} hints={[]} onHint={() => {}} revealed={true} startWith="image">
        <section className="result">
          <Verdict game={game} guess={mine ? mine.value : 0} pct={mine ? mine.pct : null} main={mine ? mine.main : 0} bonus={mine ? mine.bonus : 0} max={MAX_ROUND} hints={[]} rankLine={rankLine} noAnswer={!mine} />
          <div className="result-actions">
            <a className="btn" href={steamUrl(game)} target="_blank" rel="noreferrer">Открыть в Steam</a>
            {isHost && <button className="btn primary big" onClick={() => host.next()}>{isLast ? 'К итогам' : 'Дальше сейчас'}</button>}
          </div>
        </section>
      </GameCard>
      <section className="result mp-result">
        <div className="mp-compare-title">Сравнение раунда</div>
        <ScaleBar guesses={guesses} actual={game.reviews} />
        <table className="rounds mp-table">
          <thead>
            <tr><th>Игрок</th><th>Ответ</th><th>Правда</th><th>За раунд</th><th>Всего</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.id === me.id ? 'me' : ''}>
                <td><PlayerName state={state} id={r.id} />{r.id === me.id && <span className="dim"> · ты</span>}{best && r.id === best.id && ranked.length > 1 && <span className="tag best"> ближе всех</span>}</td>
                <td>{r.g ? <>{fmt(r.g.value)}{typeof r.g.pct === 'number' ? <span className="dim"> · {r.g.pct}%</span> : null}</> : <span className="dim">нет ответа</span>}</td>
                <td>{fmt(game.reviews)}{game.reviews > 0 ? <span className="dim"> · {positivePct(game)}%</span> : null}</td>
                <td>{r.g ? <>{fmt(r.g.main)}{r.g.bonus ? <span className="dim"> +{fmt(r.g.bonus)}</span> : null}</> : '0'}</td>
                <td><strong>{fmt(r.total)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function FinalView({ state, me, games, isHost, host, onExit }) {
  const rows = state.order.map((id) => ({ id, ...state.players[id] })).sort((a, b) => b.score - a.score);
  const winner = rows[0];
  return (
    <section className="summary">
      <h2>Итоги · {poolLabel(state.settings.pool)} · {state.settings.rounds} раундов</h2>
      {winner && <div className="summary-total"><span className="summary-points">{winner.name}</span><span className="summary-max">побеждает с {fmt(winner.score)}</span></div>}
      <table className="rounds mp-table">
        <thead><tr><th>#</th><th>Игрок</th><th>Очки</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={r.id === me.id ? 'me' : ''}>
              <td>{i + 1}</td>
              <td><PlayerName state={state} id={r.id} /></td>
              <td><strong>{fmt(r.score)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="rounds">
        <thead><tr><th>#</th><th>Игра</th><th>Правда</th>{state.order.map((id) => <th key={id}>{state.players[id].name}</th>)}</tr></thead>
        <tbody>
          {state.results.map((r, i) => {
            const g = games[r.round] && games[r.round].id === r.gameId ? games[r.round] : null;
            return (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{g ? <a href={steamUrl(g)} target="_blank" rel="noreferrer">{g.name}</a> : r.gameId}</td>
                <td>{fmt(r.truth)}</td>
                {state.order.map((id) => <td key={id}>{r.guesses[id] ? fmt(r.guesses[id].score) : <span className="dim">—</span>}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="summary-actions">
        {isHost ? <button className="btn primary big" onClick={() => host.restart()}>Ещё партию</button> : <span className="note">Хост может запустить ещё партию с теми же игроками.</span>}
        <button className="btn" onClick={onExit}>На главную</button>
      </div>
    </section>
  );
}

// -------------------------------------------------------------------- room

function Room({ data, code, me, isHost, onExit }) {
  const [state, setState] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [hints, setHints] = useState([]);
  const [answeredRound, setAnsweredRound] = useState(-1);
  const [myGuess, setMyGuess] = useState(null);
  const chan = useRef(null);
  const host = useRef(null);
  const hostSeen = useRef(Date.now());
  const [hostStale, setHostStale] = useState(false);

  useEffect(() => {
    let alive = true;
    let pingId = 0;
    let tickId = 0;
    let recovered = false;

    const h = isHost ? createHost({ code, me, data, publish: (m, r) => chan.current && chan.current.publish(m, r), onState: (s) => setState({ ...s }) }) : null;
    host.current = h;

    openChannel(code, {
      onStatus: (s) => alive && setStatus(s),
      onMessage: (msg) => {
        if (!alive) return;
        if (msg.t === 'state') {
          if (h) {
            if (!recovered) { recovered = true; h.init(msg); }
            return;
          }
          hostSeen.current = Date.now();
          setOffset(msg.now - Date.now());
          setState(msg);
          return;
        }
        if (msg.t === 'ping' && msg.from && state && msg.from === state.hostId) hostSeen.current = Date.now();
        if (h) h.handle(msg);
      },
    }).then((c) => {
      if (!alive) { c.close(); return; }
      chan.current = c;
      if (h) {
        // give a retained state a moment to arrive (host reload), otherwise start fresh
        setTimeout(() => { if (alive && !recovered) { recovered = true; h.init(null); } }, 700);
        tickId = setInterval(() => h.tick(), 5000);
      } else {
        c.publish({ t: 'join', from: me.id, name: me.name });
      }
      pingId = setInterval(() => c.publish({ t: 'ping', from: me.id, name: me.name }), 6000);
    }).catch((e) => alive && setError(e.message || String(e)));

    const staleId = setInterval(() => setHostStale(!isHost && Date.now() - hostSeen.current > 25000), 3000);

    return () => {
      alive = false;
      clearInterval(pingId);
      clearInterval(tickId);
      clearInterval(staleId);
      if (h) h.stop();
      if (chan.current) {
        if (!isHost) chan.current.publish({ t: 'leave', from: me.id });
        chan.current.close();
        chan.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isHost, me.id]);

  // host pings keep clients' "host alive" clock fresh
  useEffect(() => {
    if (!state) return;
    if (state.phase !== 'round') return;
    setHints([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state && state.round, state && state.phase]);

  const games = useMemo(() => (state && state.seed ? pickGames(data.games, state.settings.pool, state.seed, state.settings.rounds) : []), [data, state && state.seed, state && state.settings.pool, state && state.settings.rounds]);

  const submit = useCallback((g, maxScore) => {
    if (!state || state.phase !== 'round') return;
    setAnsweredRound(state.round);
    setMyGuess({ value: g.value, pct: g.pct });
    if (host.current) host.current.submitOwn(g.value, g.pct, maxScore);
    else if (chan.current) chan.current.publish({ t: 'guess', from: me.id, round: state.round, value: g.value, pct: g.pct, max: maxScore });
  }, [state, me.id]);

  if (error) return <div className="notice"><h2>Не получилось подключиться</h2><p>{error}</p><button className="btn" onClick={onExit}>На главную</button></div>;
  if (!state) return <div className="notice">{status === 'connecting' ? 'Подключаюсь к лобби…' : 'Ждём состояние лобби…'} <div className="note">Код {code}</div></div>;

  const inGame = !!state.players[me.id];
  const spectator = !inGame && state.phase !== 'lobby';
  const answered = answeredRound === state.round || state.answered.includes(me.id);
  const isLast = state.round + 1 >= state.settings.rounds;

  return (
    <div className="mp">
      {hostStale && <div className="banner">Хост давно не выходил на связь. Если он закрыл вкладку, создайте новое лобби.</div>}
      {spectator && <div className="banner">Игра уже идёт, ты смотришь как зритель. Присоединиться можно в следующей партии.</div>}
      {!inGame && state.phase === 'lobby' && status === 'connected' && <div className="banner">Заходим в лобби…</div>}
      {state.phase === 'lobby' && <Lobby state={state} me={me} isHost={isHost} host={host.current} status={status} />}
      {state.phase === 'round' && <RoundView state={state} me={me} games={games} offset={offset} answered={answered || spectator} myGuess={answeredRound === state.round ? myGuess : null} onSubmit={submit} hints={hints} onHint={(id) => setHints([...hints, id])} />}
      {state.phase === 'reveal' && <RevealView state={state} me={me} games={games} data={data} offset={offset} isHost={isHost} host={host.current} isLast={isLast} />}
      {state.phase === 'final' && <FinalView state={state} me={me} games={games} isHost={isHost} host={host.current} onExit={onExit} />}
      <div className="mp-foot">
        <button className="link" onClick={onExit}>Выйти из лобби</button>
        <span className="dim">код {state.code} · {status === 'connected' ? 'связь есть' : status}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ export

export default function Multiplayer({ data, lobby, onLobby, onExit }) {
  const [me, setMe] = useState(null);
  const isHost = !!lobby && (() => { try { return sessionStorage.getItem('sg-host-' + lobby) === '1'; } catch { return false; } })();

  if (!lobby || !me) {
    return (
      <Entry
        initialCode={lobby || ''}
        onCreate={(name) => {
          const code = makeLobbyCode();
          try { sessionStorage.setItem('sg-host-' + code, '1'); } catch { /* ignore */ }
          const ident = playerIdentity();
          setMe({ id: ident.id, name });
          onLobby(code);
        }}
        onJoin={(code, name) => {
          const ident = playerIdentity();
          setMe({ id: ident.id, name });
          if (code !== lobby) onLobby(code);
        }}
      />
    );
  }
  return <Room key={lobby} data={data} code={lobby} me={me} isHost={isHost} onExit={onExit} />;
}
