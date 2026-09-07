import { useMemo, useState } from 'react';
import { POOLS, fmt, MAX_ROUND, ROUNDS } from '../lib/scoring.js';
import { loadStats } from '../lib/storage.js';
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

export default function Home({ data, onStart }) {
  const [pool, setPool] = useState('mix');
  const stats = loadStats();
  const today = todayKey();
  const dailyDone = stats.daily[today];

  // decorative strip of capsules, reshuffled on every visit
  const band = useMemo(() => {
    const known = data.games.filter((g) => g.reviews >= 5000);
    return seededShuffle(known.length >= 12 ? known : data.games, mulberry32(Date.now() % 100000)).slice(0, 12);
  }, [data]);

  return (
    <div className="home">
      <section className="hero">
        <h1>Угадай, сколько отзывов у игры в Steam</h1>
        <p>Случайная игра, ползунок и пять раундов. Чем ближе к правде, тем больше очков: попадание в два раза даёт ~4000 из 5000, промах в десять раз около 1700.</p>
      </section>

      <div className="band" aria-hidden="true">
        <div className="band-row">
          {band.map((g) => <img key={g.id} src={g.img} alt="" loading="lazy" />)}
        </div>
      </div>

      <div className="modes">
        <section className="mode">
          <div className="mode-head"><IconTarget /><h2>Классика</h2></div>
          <p>{ROUNDS} раундов, максимум {fmt(ROUNDS * MAX_ROUND)} очков. Подсказки открываются за часть очков раунда.</p>
          <div className="chips">
            {POOLS.map((p) => {
              const n = poolGames(data.games, p.id).length;
              return (
                <button
                  key={p.id}
                  className={'chip' + (pool === p.id ? ' active' : '')}
                  disabled={n < ROUNDS}
                  title={`${p.hint} · ${n} игр`}
                  onClick={() => setPool(p.id)}
                >
                  {p.label} <span className="chip-n">{n}</span>
                </button>
              );
            })}
          </div>
          <button className="btn primary" onClick={() => onStart({ name: 'classic', pool, seed: randomSeed() })}>Играть</button>
          {stats.classicGames > 0 && (
            <div className="mode-stats">Лучший результат: {fmt(stats.classicBest)} · сыграно партий: {stats.classicGames}</div>
          )}
        </section>

        <section className="mode">
          <div className="mode-head"><IconCalendar /><h2>Дейли</h2></div>
          <p>Один набор из пяти игр на всех на сегодня, {today.split('-').reverse().join('.')}. Сравнивай результат с друзьями.</p>
          <button className="btn primary" onClick={() => onStart({ name: 'classic', daily: true, pool: 'mix', seed: 'daily-' + today })}>
            {dailyDone ? 'Посмотреть результат' : 'Играть дейли'}
          </button>
          {dailyDone && <div className="mode-stats">Сегодня: {fmt(dailyDone.score)} очков {dailyDone.grid}</div>}
        </section>

        <section className="mode">
          <div className="mode-head"><IconScales /><h2>Больше / Меньше</h2></div>
          <p>Две игры: у правой отзывов больше или меньше, чем у левой? Считаем серию.</p>
          <button className="btn primary" onClick={() => onStart({ name: 'hilo', seed: randomSeed() })}>Играть</button>
          {stats.hiloBest > 0 && <div className="mode-stats">Рекордная серия: {stats.hiloBest}</div>}
        </section>
      </div>

      <section className="howto">
        <h3>Как это работает</h3>
        <ul>
          <li>Загадывается число отзывов на всех языках, то же, что Steam показывает в строке «Все обзоры».</li>
          <li>Ссылка с сидом воспроизводит тот же набор игр: отправь её другу и сравни очки.</li>
          <li>Очки за раунд: 5000 × (1 − |log₁₀(ответ / правда)| / 1,5), минус стоимость открытых подсказок.</li>
        </ul>
      </section>
    </div>
  );
}
