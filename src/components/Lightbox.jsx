import { useEffect } from 'react';
import { createPortal } from 'react-dom';

function Chevron({ dir }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === 'left' ? <path d="M15 5l-7 7 7 7"></path> : <path d="M9 5l7 7-7 7"></path>}
    </svg>
  );
}

// Steam-style media popup: image or trailer, arrows, Esc / click outside to close.
export default function Lightbox({ items, index, onClose, onIndex }) {
  const count = items.length;
  const prev = () => onIndex((index - 1 + count) % count);
  const next = () => onIndex((index + 1) % count);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  });

  const cur = items[index];
  if (!cur) return null;

  return createPortal(
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label="Просмотр">
      <div className="lightbox-body" onClick={(e) => e.stopPropagation()}>
        {cur.type === 'video' ? (
          <video key={cur.webm} className="lightbox-media" controls autoPlay playsInline poster={cur.poster}>
            <source src={cur.webm} type="video/webm" />
            <source src={cur.mp4} type="video/mp4" />
          </video>
        ) : (
          <img key={cur.full} className="lightbox-media" src={cur.full} alt="" />
        )}
        {count > 1 && (
          <>
            <button type="button" className="lightbox-nav prev" onClick={prev} aria-label="Предыдущий"><Chevron dir="left" /></button>
            <button type="button" className="lightbox-nav next" onClick={next} aria-label="Следующий"><Chevron dir="right" /></button>
          </>
        )}
        <button type="button" className="lightbox-close" onClick={onClose} aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
        </button>
        <div className="lightbox-counter">{index + 1} / {count}</div>
      </div>
    </div>,
    document.body,
  );
}
