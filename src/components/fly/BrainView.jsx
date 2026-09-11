import { useEffect, useRef, useState } from 'react';
import { fmt, t } from '../../lib/i18n.js';

// The brain panel: FlyWire point cloud with the circuit lighting up in a PN -> KC -> MBON wave for
// every new game. `prediction` carries the real activations; `animate` is false when a finished
// round is restored, so the final state shows at once.
export default function BrainView({ prediction, model, animate, gameId }) {
  const root = useRef(null), host = useRef(null), api = useRef(null), latest = useRef({ prediction, model, animate });
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState('');
  const [stats, setStats] = useState(null);
  latest.current = { prediction, model, animate };

  useEffect(() => {
    let active = true;
    Promise.all([import('../../lib/fly/brain.js'), import('../../lib/fly/brain.js').then((m) => m.loadBrain(import.meta.env.BASE_URL))]).then(([m, data]) => {
      if (!active) return;
      api.current = m.createBrainView(host.current, { data, onPhase: (p) => active && setPhase(p), onStats: (s) => active && setStats(s) });
      const v = latest.current;
      if (v.prediction) api.current.setActivation(v.prediction.state, v.model, v.animate);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; api.current?.dispose(); api.current = null; };
  }, []);

  useEffect(() => {
    if (api.current && prediction) api.current.setActivation(prediction.state, model, animate);
    // a new game starts a new wave; the same game (e.g. reveal) keeps the current state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, prediction, model]);

  function expand() {
    const panel = root.current;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (panel.requestFullscreen) panel.requestFullscreen();
      else panel.classList.toggle('expanded');
    } catch { panel.classList.toggle('expanded'); }
  }

  const layer = (id, label) => <span className={'brain-layer' + (phase === id ? ' on' : phase === 'done' || ['pn', 'kc', 'mbon'].indexOf(phase) > ['pn', 'kc', 'mbon'].indexOf(id) ? ' past' : '')}>{label}</span>;
  return <section className="fly-brain-panel" ref={root} aria-label={t('fly.brainTitle')}>
    <div className="fly-scene-toolbar">
      <div><span className="fly-cam-label">{t('fly.brainTitle')}</span><b className="brain-phase">{phase === 'done' ? t('fly.brainDone') : phase ? t('fly.brainThinking') : t('fly.loading')}</b></div>
      <div className="fly-scene-buttons">
        <button type="button" title={t('fly.reset')} aria-label={t('fly.reset')} disabled={failed} onClick={() => api.current?.reset()}>↺</button>
        <button type="button" title={t('fly.expand')} aria-label={t('fly.expand')} disabled={failed} onClick={expand}>⛶</button>
      </div>
    </div>
    <div className="fly-scene-canvas" ref={host} />
    <div className="brain-layers" aria-hidden="true">{layer('pn', 'PN')}<i>→</i>{layer('kc', 'KC')}<i>→</i>{layer('mbon', 'MBON')}</div>
    <div className="brain-caption">
      <span>{stats ? t('fly.brainCaption', { n: fmt(stats.points), c: fmt(stats.nPN + stats.nKC + stats.nMBON) }) : ''}</span>
      <span>{stats ? t('fly.brainActive', { a: fmt(stats.activeKC), n: fmt(stats.nKC) }) : ''}</span>
    </div>
    {failed && <p className="fly-scene-fallback" role="status">{t('fly.brainFallback')}</p>}
  </section>;
}
