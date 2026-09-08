import { useEffect, useRef, useState } from 'react';
import { LANGS, getLang, setLang, t, useLang } from '../lib/i18n.js';
import Flag from './Flags.jsx';

// Flag button in the header; opens a list of flags (names only as tooltips).
export default function LangSwitch() {
  useLang();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const cur = LANGS.find((l) => l.code === getLang()) || LANGS[1];

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

  return (
    <div className="lang-switch" ref={box}>
      <button type="button" className="lang-btn" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} title={`${t('app.lang')}: ${cur.name}`}>
        <Flag code={cur.code} label={cur.name} />
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="lang-menu" role="listbox" aria-label={t('app.lang')}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              role="option"
              aria-selected={l.code === cur.code}
              className={'lang-item' + (l.code === cur.code ? ' active' : '')}
              title={l.name}
              onClick={() => { setLang(l.code); setOpen(false); }}
            >
              <Flag code={l.code} label={l.name} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
