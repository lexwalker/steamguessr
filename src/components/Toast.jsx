import { useEffect, useState } from 'react';
import { onToast, ACH_ICON } from '../lib/progress.js';
import { t } from '../lib/i18n.js';

// Bottom-right stack of short messages (achievement unlocks); each disappears after a few seconds.
export default function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => onToast((msg) => {
    const id = Math.random().toString(36).slice(2);
    setItems((list) => [...list, { ...msg, key: id }]);
    setTimeout(() => setItems((list) => list.filter((x) => x.key !== id)), 4500);
  }), []);
  if (!items.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {items.map((m) => (
        <div key={m.key} className="toast">
          <span className={'toast-icon' + (ACH_ICON[m.id] === 'S' ? ' grade S' : '')}>{ACH_ICON[m.id] || '★'}</span>
          <div>
            <div className="toast-kicker">{t('ach.unlocked')}</div>
            <div className="toast-title">{t('ach.' + m.id)}</div>
            <div className="toast-desc">{t('ach.' + m.id + '.d')}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
