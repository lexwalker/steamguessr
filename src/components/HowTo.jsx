import { useState } from 'react';
import { t } from '../lib/i18n.js';

const KEY = 'steamguessr-howto';

// One-time strip explaining the loop; disappears for good after "Got it".
export default function HowTo({ multiplayer = false }) {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
  });
  if (hidden) return null;
  function dismiss() {
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    setHidden(true);
  }
  return (
    <div className="howto-strip" role="note">
      <ol>
        <li><b>{t('howto.1b')}</b>{t('howto.1')}</li>
        <li><b>{t('howto.2b')}</b>{multiplayer ? t('howto.2mp') : t('howto.2')}</li>
        <li><b>{t('howto.3b')}</b>{multiplayer ? t('howto.3mp') : t('howto.3')}</li>
      </ol>
      <button type="button" className="btn" onClick={dismiss}>{t('howto.ok')}</button>
    </div>
  );
}
