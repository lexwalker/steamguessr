import { useEffect, useRef, useState } from 'react';
import { t } from '../../lib/i18n.js';

export default function FlyScene({ game, prediction, result }) {
  const root = useRef(null), host = useRef(null), api = useRef(null), latest = useRef({ game, prediction, result });
  const [failed, setFailed] = useState(false);
  latest.current = { game, prediction, result };

  useEffect(() => {
    let active = true;
    import('../../lib/fly/scene.js').then(({ createFlyScene }) => {
      if (!active) return;
      api.current = createFlyScene(host.current, { root: root.current, translate: t });
      const value = latest.current;
      api.current.setGame(value.game);
      api.current.setPrediction(value.prediction);
      if (value.result) api.current.reveal(value.prediction, value.result.human.score, value.result.fly.score);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; api.current?.dispose(); api.current = null; };
  }, []);

  useEffect(() => {
    if (!api.current) return;
    api.current.setGame(game);
    api.current.setPrediction(prediction);
  }, [game, prediction]);
  useEffect(() => {
    if (api.current && result) api.current.reveal(prediction, result.human.score, result.fly.score);
  }, [result, prediction]);

  return <section className="fly-scene-panel" ref={root} aria-label={t('fly.scene')}>
    <div className="fly-scene-toolbar"><div><span className="fly-cam-label">FLY CAM</span><b id="scene-status">{t('fly.phase.waiting')}</b></div><div className="fly-scene-buttons">
      <button type="button" id="scene-motion" title={t('fly.pause')} aria-label={t('fly.pause')} disabled={failed}>Ⅱ</button>
      <button type="button" id="scene-reset" title={t('fly.reset')} aria-label={t('fly.reset')} disabled={failed}>↺</button>
      <button type="button" id="scene-expand" title={t('fly.expand')} aria-label={t('fly.expand')} disabled={failed}>⛶</button>
    </div></div>
    <div className="fly-scene-canvas" ref={host} />
    {!failed && <div className="fly-scene-neural"><span>{t('fly.signal')}</span><strong id="scene-activity">—</strong><small id="scene-cell-count">{t('fly.loading')}</small></div>}
    <div className="fly-scene-caption"><span>{t('fly.cameraHint')}</span><span id="scene-readout">{t('fly.hidden')}</span></div>
    {failed && <p className="fly-scene-fallback" role="status">{t('fly.sceneFallback')}</p>}
  </section>;
}
