import { useEffect, useRef, useState } from 'react';
import { THEMES, applyTheme, currentTheme, themeLabel } from '../lib/themes.js';

export default function ThemeSwitch() {
  const [theme, setTheme] = useState(currentTheme);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(id) {
    setTheme(applyTheme(id));
    setOpen(false);
  }

  return (
    <div className="theme-switch" ref={box}>
      <button type="button" className="theme-btn" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} title="Сменить оформление">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2v-1a2 2 0 0 1 2-2h1a4 4 0 0 0 4-4 9 9 0 0 0-9-9z"></path>
          <circle cx="7.5" cy="11.5" r="1.2"></circle>
          <circle cx="11" cy="7.5" r="1.2"></circle>
          <circle cx="16" cy="8.5" r="1.2"></circle>
        </svg>
        <span>{themeLabel(theme)}</span>
      </button>
      {open && (
        <div className="theme-menu" role="menu">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={t.id === theme}
              className={'theme-item' + (t.id === theme ? ' active' : '')}
              onClick={() => pick(t.id)}
            >
              <span className="theme-swatch" style={{ background: t.swatch[0], borderColor: t.swatch[1] }}>
                <span style={{ background: t.swatch[1] }}></span>
              </span>
              <span className="theme-name">{t.label}</span>
              <span className="theme-hint">{t.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
