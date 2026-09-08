import { useMemo, useState } from 'react';
import { POOLS, fmt, ROUND_TOTAL, ROUNDS, daysWord } from '../lib/scoring.js';
import { loadStats, currentStreak } from '../lib/storage.js';
import { poolGames } from '../lib/data.js';
import { mulberry32, randomSeed, seededShuffle, todayKey } from '../lib/rng.js';

function IconTarget() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1"></circle>
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>
    </svg>
  );
}
function IconScales() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18M5 21h14M3 8l4 8H1l2-8zM17 8l4 8h-6l2-8zM3 8h18"></path>
    </svg>
  );
}
function IconPeople() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><circle cx="17" cy="9" r="2.5"></circle><path d="M15.5 14.5a5 5 0 0 1 6 4.5"></path>
    </svg>
  );
}

export default function Home({ data, onStart }) {
  const [pool, setPool] = useState('mix');
  const [code, setCode] = useState('');
  const stats = loadStats();
  const today = todayKey();
  const dailyDone = stats.daily[today];
  const streak = currentStreak(stats, today);

  // capsules drifting behind the title, reshuffled on every visit
  const band = useMemo(() => {
    const known = data.games.filter((g) => g.reviews >= 5000);
    return seededShuffle(known.length >= 14 ? known : data.games, mulberry32(Date.now() % 100000)).slice(0, 14);
  }, [data]);

  const counts = useMemo(() => Object.fromEntries(POOLS.map((p) => [p.id, poolGames(data.games, p.id).length])), [data]);
  const chip = (p) => (
    <button
      key={p.id}
      className={'chip' + (pool === p.id ? ' active' : '')}
      disabled={counts[p.id] < ROUNDS}
      title={`${p.hint} · ${counts[p.id]} игр`}
      onClick={() => setPool(p.id)}
    >
      {p.label} <span className="chip-n">{counts[p.id]}</span>
    </button>
  );
  const startClassic = () => onStart({ name: 'classic', pool, seed: randomSeed() });

  return (
    <div className="home">
      <section className="hero-wrap">
        <div className="hero-bg" aria-hidden="true">
          <div className="band-row">
            {[...band, ...band].map((g, i) => <img key={g.id + '-' + i} src={g.img} alt="" />)}
          </div>
        </div>
        <div className="hero">
          <h1>Угадай, сколько отзывов у игры в Steam</h1>
          <p>Случайная игра, ползунок и пять раундов. Чем ближе к правде, тем больше очков.</p>
          <div className="hero-actions">
            <button className="btn primary big" onClick={startClassic}>Играть</button>
            <button className="btn big" onClick={() => onStart({ name: 'mp', lobby: null })}>Играть вместе</button>
          </div>
        </div>
      </section>

      <div className="modes">
        <section className="mode">
          <div className="mode-head"><span className="mode-icon"><IconTarget /></span><h2>Классика</h2></div>
          <p>{ROUNDS} раундов, до {fmt(ROUNDS * ROUND_TOTAL)} очков. Подсказки открываются за часть очков раунда.</p>
          <div className="pool-groups">
            <div className="chips">{POOLS.filter((p) => !p.byTag).map(chip)}</div>
            <div className="chips">{POOLS.filter((p) => p.byTag).map(chip)}</div>
          </div>
          <div className="mode-actions">
            <button className="btn primary" onClick={startClassic}>Играть</button>
            {stats.classicGames > 0 && <span className="mode-stats">Лучший: {fmt(stats.classicBest)} · партий: {stats.classicGames}</span>}
          </div>
        </section>

        <section className="mode">
          <div className="mode-head"><span className="mode-icon"><IconPeople /></span><h2>Вместе</h2></div>
          <p>Лобби по коду на 2–8 игроков. Одна игра на всех, общий таймер, после каждого раунда сравнение ответов с правдой.</p>
          <form className="mp-join" onSubmit={(e) => { e.preventDefault(); if (code.length === 5) onStart({ name: 'mp', lobby: code }); }}>
            <input className="typed code" maxLength={5} placeholder="КОД" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} aria-label="Код лобби" />
            <button type="submit" className="btn" disabled={code.length !== 5}>Войти по коду</button>
          </form>
          <div className="mode-actions">
            <button className="btn primary" onClick={() => onStart({ name: 'mp', lobby: null })}>Создать лобби</button>
          </div>
        </section>

        <section className="mode">
          <div className="mode-head"><span className="mode-icon"><IconCalendar /></span><h2>Дейли</h2></div>
          <p>Один набор из пяти игр на всех на сегодня, {today.split('-').reverse().join('.')}. Сравни результат с друзьями.</p>
          <div className="mode-actions">
            <button className="btn primary" onClick={() => onStart({ name: 'classic', daily: true, pool: 'mix', seed: 'daily-' + today })}>
              {dailyDone ? 'Посмотреть результат' : 'Играть дейли'}
            </button>
            <span className="mode-stats">
              {dailyDone ? <>{fmt(dailyDone.score)} {dailyDone.grid} · </> : null}
              {streak > 0 ? <>🔥 {streak} {daysWord(streak)} подряд</> : 'серия дней пока 0'}
            </span>
          </div>
        </section>

        <section className="mode">
          <div className="mode-head"><span className="mode-icon"><IconScales /></span><h2>Больше / Меньше</h2></div>
          <p>У правой игры отзывов больше или меньше, чем у левой? Считаем серию верных ответов.</p>
          <div className="mode-actions">
            <button className="btn primary" onClick={() => onStart({ name: 'hilo', seed: randomSeed() })}>Играть</button>
            {stats.hiloBest > 0 && <span className="mode-stats">Рекорд: {stats.hiloBest}</span>}
          </div>
        </section>
      </div>

      <details className="howto">
        <summary>Как считаются очки</summary>
        <ul>
          <li>Загадывается число отзывов на всех языках, то же, что Steam показывает в строке «Все обзоры».</li>
          <li>За число: 5000 × (1 − |log₁₀(ответ / правда)| / 1,5), минус стоимость открытых подсказок. Попадание в два раза даёт около 4000, промах в десять раз около 1700.</li>
          <li>Бонус за оценку: 1000 × (1 − |разница процентов| / 30).</li>
          <li>Ссылка с сидом воспроизводит тот же набор игр: отправь её другу и сравни очки.</li>
        </ul>
      </details>
    </div>
  );
}
