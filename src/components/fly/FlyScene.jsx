import { useEffect, useRef, useState } from 'react';
import { langTag, t } from '../../lib/i18n.js';

// Kenyon-cell activity as a small raster: one dot per cell, brighter = more active.
function drawBrain(canvas, prediction, model) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#0b1a15';
  ctx.fillRect(0, 0, W, H);
  if (!prediction || !model) return;
  const kc = prediction.state.slice(model.nPN, model.nPN + model.nKC);
  const cols = Math.ceil(Math.sqrt(kc.length * (W / H)));
  const rows = Math.ceil(kc.length / cols);
  const cw = W / cols, ch = H / rows;
  let max = 0;
  for (const v of kc) if (v > max) max = v;
  for (let i = 0; i < kc.length; i++) {
    const a = max > 0 ? Math.min(1, kc[i] / max) : 0;
    if (a <= 0) continue;
    ctx.fillStyle = `rgba(197, 239, 133, ${0.15 + a * 0.85})`;
    ctx.fillRect((i % cols) * cw, Math.floor(i / cols) * ch, Math.max(1, cw - 0.4), Math.max(1, ch - 0.4));
  }
}

export default function FlyScene({ game, prediction, result, model }) {
  const root = useRef(null), host = useRef(null), brain = useRef(null), api = useRef(null), latest = useRef({ game, prediction, result });
  const [failed, setFailed] = useState(false);
  latest.current = { game, prediction, result };

  useEffect(() => {
    let active = true;
    import('../../lib/fly/scene.js').then(({ createFlyScene }) => {
      if (!active) return;
      api.current = createFlyScene(host.current, { root: root.current, translate: t, locale: langTag() });
      const value = latest.current;
      api.current.setGame(value.game);
      api.current.setPrediction(value.prediction);
      if (value.result && value.prediction) api.current.reveal(value.prediction, value.result.human.score, value.result.fly.score);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; api.current?.dispose(); api.current = null; };
  }, []);

  useEffect(() => {
    if (!api.current) return;
    api.current.setGame(game);
    api.current.setPrediction(prediction);
  }, [game, prediction]);
  useEffect(() => {
    if (api.current && result && prediction) api.current.reveal(prediction, result.human.score, result.fly.score);
  }, [result, prediction]);
  useEffect(() => { drawBrain(brain.current, prediction, model); }, [prediction, model]);

  return <section className="fly-scene-panel" ref={root} aria-label={t('fly.scene')}>
    <div className="fly-scene-toolbar"><div><span className="fly-cam-label">FLY CAM</span><b id="scene-status">{t('fly.phase.waiting')}</b></div><div className="fly-scene-buttons">
      <button type="button" id="scene-motion" title={t('fly.pause')} aria-label={t('fly.pause')} disabled={failed}>Ⅱ</button>
      <button type="button" id="scene-reset" title={t('fly.reset')} aria-label={t('fly.reset')} disabled={failed}>↺</button>
      <button type="button" id="scene-expand" title={t('fly.expand')} aria-label={t('fly.expand')} disabled={failed}>⛶</button>
    </div></div>
    <div className="fly-scene-canvas" ref={host} />
    <div className="fly-scene-neural">
      <span>{t('fly.signal')}</span>
      <strong id="scene-activity">—</strong>
      <canvas ref={brain} className="fly-brain" width={176} height={56} aria-label={t('fly.brain')} />
      <small id="scene-cell-count">{t('fly.loading')}</small>
    </div>
    <div className="fly-scene-caption"><span>{t('fly.cameraHint')}</span><span id="scene-readout">{t('fly.hidden')}</span></div>
    {failed && <p className="fly-scene-fallback" role="status">{t('fly.sceneFallback')}</p>}
  </section>;
}
