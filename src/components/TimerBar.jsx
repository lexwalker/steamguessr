import { useEffect, useState } from 'react';
import { t } from '../lib/i18n.js';

// Shrinking bar with seconds left. `deadline` is on the local clock once `offset` is applied.
export default function TimerBar({ deadline, offset = 0, total }) {
  const [left, setLeft] = useState(() => Math.max(0, deadline - offset - Date.now()));
  useEffect(() => {
    setLeft(Math.max(0, deadline - offset - Date.now()));
    const id = setInterval(() => setLeft(Math.max(0, deadline - offset - Date.now())), 250);
    return () => clearInterval(id);
  }, [deadline, offset]);
  const secs = Math.ceil(left / 1000);
  const frac = total ? Math.min(1, left / (total * 1000)) : 1;
  return (
    <div className={'timer' + (secs <= 5 ? ' low' : '')}>
      <div className="timer-track"><div className="timer-fill" style={{ width: `${frac * 100}%` }}></div></div>
      <span className="timer-text">{t('mp.seconds', { n: secs })}</span>
    </div>
  );
}
