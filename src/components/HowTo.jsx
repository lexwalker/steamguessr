import { useState } from 'react';

const KEY = 'steamguessr-howto';

// One-time strip explaining the loop; disappears for good after "Понятно".
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
        <li><b>Посмотри игру</b>: трейлер, скриншоты, теги, дата и цена слева.</li>
        <li><b>Оцени число отзывов и оценку</b> двумя ползунками справа{multiplayer ? ', пока идёт таймер' : ''}.</li>
        <li><b>Нажми «Ответить»</b>{multiplayer ? ', сравнение появится, когда ответят все' : ' и увидишь правду'}.</li>
      </ol>
      <button type="button" className="btn" onClick={dismiss}>Понятно</button>
    </div>
  );
}
