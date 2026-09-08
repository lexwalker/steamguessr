import { useMemo, useState } from 'react';
import { HINTS, fmt } from '../lib/scoring.js';
import { movieUrls } from '../lib/data.js';
import Lightbox from './Lightbox.jsx';

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

function PlayIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>
  );
}

function ZoomIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"></path>
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

export default function GameCard({ game, hints, onHint, revealed, startWith = 'trailer' }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const items = useMemo(() => {
    const list = [];
    const mv = movieUrls(game.movie);
    if (mv && !videoFailed) list.push({ type: 'video', ...mv, poster: game.img, thumb: game.img });
    list.push({ type: 'image', src: game.img, full: game.img, thumb: game.img });
    for (const s of game.shots) list.push({ type: 'image', src: s, full: s.replace('.600x338', '.1920x1080'), thumb: s });
    return list;
  }, [game, videoFailed]);

  const [active, setActive] = useState(() => (startWith === 'image' && movieUrls(game.movie) ? 1 : 0));
  const [lightbox, setLightbox] = useState(-1);
  const unlocked = (id) => revealed || hints.includes(id);
  const [tags, details, press] = HINTS;
  const cur = items[Math.min(active, items.length - 1)];

  return (
    <section className="card">
      <div className="card-media">
        <div className="card-viewer">
          {cur.type === 'video' ? (
            <video key={cur.webm} className="card-video" controls autoPlay muted playsInline poster={cur.poster}>
              <source src={cur.webm} type="video/webm" />
              <source src={cur.mp4} type="video/mp4" onError={() => setVideoFailed(true)} />
            </video>
          ) : (
            <button type="button" className="card-main" onClick={() => setLightbox(active)} title="Увеличить">
              <img className="card-bg" src={cur.src} alt="" aria-hidden="true" />
              <img className="card-fg" src={cur.src} alt="" />
              <span className="zoom-badge"><ZoomIcon /></span>
            </button>
          )}
        </div>
        {items.length > 1 && (
          <div className="shots">
            {items.map((it, i) => (
              <button key={it.type + (it.thumb || it.webm)} type="button" className={'shot' + (i === active ? ' active' : '') + (it.type === 'video' ? ' video' : '')} onClick={() => setActive(i)}>
                <img src={it.thumb} alt="" loading="lazy" />
                {it.type === 'video' && <span className="play-badge"><PlayIcon size={18} /></span>}
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

      {lightbox >= 0 && (
        <Lightbox items={items} index={Math.min(lightbox, items.length - 1)} onClose={() => setLightbox(-1)} onIndex={(i) => { setLightbox(i); setActive(i); }} />
      )}
    </section>
  );
}
