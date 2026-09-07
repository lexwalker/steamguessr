import { useState } from 'react';
import { HINTS, fmt } from '../lib/scoring.js';

function priceText(g) {
  if (g.price === 0) return 'бесплатно';
  return g.priceText || 'нет в продаже';
}

const PLATFORM_LABEL = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };

// SteamSpy gives "5,000,000 .. 10,000,000"; show it as "5 000 000 – 10 000 000"
function ownersText(s) {
  const nums = String(s || '').split('..').map((x) => parseInt(x.replace(/\D/g, ''), 10)).filter(Number.isFinite);
  return nums.length === 2 ? `${fmt(nums[0])} – ${fmt(nums[1])}` : s;
}

function LockIcon() {
  return (
    <svg className="hint-lock" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2"></rect>
      <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
    </svg>
  );
}

function HintBlock({ hint, unlocked, onHint, children }) {
  if (unlocked) {
    return (
      <div className="hint open">
        <div className="hint-label">{hint.label}</div>
        <div className="hint-body">{children}</div>
      </div>
    );
  }
  return (
    <button type="button" className="hint locked" onClick={() => onHint(hint.id)}>
      <LockIcon />
      <span className="hint-name">{hint.label}</span>
      <span className="hint-cost">−{fmt(hint.cost)}</span>
    </button>
  );
}

export default function GameCard({ game, hints, onHint, revealed }) {
  const [active, setActive] = useState(-1); // -1 shows the header image, otherwise a screenshot index
  const unlocked = (id) => revealed || hints.includes(id);
  const [tags, details, press] = HINTS;
  const shot = active >= 0 ? game.shots[active] : null;
  const main = shot || game.img;
  const full = shot ? shot.replace('.600x338', '.1920x1080') : game.img;

  return (
    <section className="card">
      <div className="card-media">
        <a className="card-main" href={full} target="_blank" rel="noreferrer" title="Открыть в полном размере">
          <img className="card-bg" src={main} alt="" aria-hidden="true" />
          <img className="card-fg" src={main} alt="" />
        </a>
        {game.shots.length > 0 && (
          <div className="shots">
            <button type="button" className={'shot' + (active === -1 ? ' active' : '')} onClick={() => setActive(-1)}>
              <img src={game.img} alt="" />
            </button>
            {game.shots.map((s, i) => (
              <button key={s} type="button" className={'shot' + (active === i ? ' active' : '')} onClick={() => setActive(i)}>
                <img src={s} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card-body">
        <h2 className="card-title">{game.name}</h2>
        <p className="card-desc">{game.desc}</p>

        <div className="hints">
          <HintBlock hint={tags} unlocked={unlocked('tags')} onHint={onHint}>
            <div className="tags">
              {game.tags.map((t) => <span key={t} className="tag">{t}</span>)}
              {game.tags.length === 0 && game.genres.map((t) => <span key={t} className="tag">{t}</span>)}
            </div>
          </HintBlock>

          <HintBlock hint={details} unlocked={unlocked('details')} onHint={onHint}>
            <dl className="kv">
              <dt>Дата выхода</dt><dd>{game.date || (game.year ?? '—')}</dd>
              <dt>Цена</dt><dd>{priceText(game)}</dd>
              <dt>Разработчик</dt><dd>{game.dev.join(', ') || '—'}</dd>
              <dt>Платформы</dt><dd>{game.platforms.map((p) => PLATFORM_LABEL[p] || p).join(', ') || '—'}</dd>
            </dl>
          </HintBlock>

          <HintBlock hint={press} unlocked={unlocked('press')} onHint={onHint}>
            <dl className="kv">
              <dt>Metacritic</dt><dd>{game.meta ?? 'нет оценки'}</dd>
              <dt>DLC</dt><dd>{game.dlc}</dd>
              <dt>Достижений</dt><dd>{game.ach}</dd>
            </dl>
          </HintBlock>

          {revealed && (
            <div className="hint open">
              <div className="hint-label">Издатель</div>
              <div className="hint-body">
                {game.pub.join(', ') || '—'}
                {game.owners ? ` · владельцев по SteamSpy: ${ownersText(game.owners)}` : ''}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
