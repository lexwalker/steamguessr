import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WAVE_MS, WAVE_WINDOWS } from './constants.js';

// The whole FlyWire brain as a dim point cloud, the circuit's 2415 neurons as bright points whose
// brightness follows the real activations of the current game. Loaded only in the fly mode.

let pending;
export function loadBrain(baseUrl) {
  if (!pending) {
    pending = Promise.all([fetch(`${baseUrl}fly/brain.bin`), fetch(`${baseUrl}fly/pathway.json`)]).then(async ([a, b]) => {
      if (!a.ok || !b.ok) throw new Error('brain data');
      const buf = await a.arrayBuffer();
      const len = new DataView(buf).getUint32(0, true);
      const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, len)));
      const positions = new Uint16Array(buf.slice(4 + len, 4 + len + header.count * 6));
      const groups = new Uint8Array(buf.slice(4 + len + header.count * 6, 4 + len + header.count * 7));
      return { header, positions, groups, pathway: await b.json() };
    }).catch((e) => { pending = undefined; throw e; });
  }
  return pending;
}

const LAYER_COLOR = { pn: new THREE.Color('#5fd0ff'), kc: new THREE.Color('#b8f26a'), mbon: new THREE.Color('#ffb454') };

function groupPalette(names) {
  // a muted hue per neuropil so the silhouette reads like the FlyWire viewer
  return names.map((name, i) => { const h = ((i * 0.618033) % 1); return new THREE.Color().setHSL(h, 0.45, 0.42); });
}

export function createBrainView(host, { data, onPhase, onStats } = {}) {
  let disposed = false, raf = 0, waveStart = 0, waveOn = false, lastPhase = '';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050e16');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.append(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 30);
  const home = new THREE.Vector3(0.2, 1.05, 2.9);
  camera.position.copy(home);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.07; controls.enablePan = false;
  controls.minDistance = 1.2; controls.maxDistance = 6; controls.autoRotate = true; controls.autoRotateSpeed = 0.55;

  // normalized [0,1] space -> centred, 2 units wide; FlyWire z is the anterior-posterior axis, so tilt it up
  const toWorld = (x, y, z) => new THREE.Vector3((x - 0.5) * 2, -(y - 0.5) * 2, (z - 0.5) * 2);
  const world = new THREE.Group();
  world.rotation.x = -0.35;
  scene.add(world);

  const { header, positions, groups, pathway } = data;
  const bg = new Float32Array(header.count * 3);
  const bgColor = new Float32Array(header.count * 3);
  const palette = groupPalette(header.groups);
  for (let i = 0; i < header.count; i++) {
    const v = toWorld(positions[i * 3] / 65535, positions[i * 3 + 1] / 65535, positions[i * 3 + 2] / 65535);
    bg[i * 3] = v.x; bg[i * 3 + 1] = v.y; bg[i * 3 + 2] = v.z;
    const c = palette[groups[i]] || palette[0];
    bgColor[i * 3] = c.r; bgColor[i * 3 + 1] = c.g; bgColor[i * 3 + 2] = c.b;
  }
  const bgGeo = new THREE.BufferGeometry();
  bgGeo.setAttribute('position', new THREE.BufferAttribute(bg, 3));
  bgGeo.setAttribute('color', new THREE.BufferAttribute(bgColor, 3));
  const bgMat = new THREE.PointsMaterial({ size: 1.15, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.085, blending: THREE.AdditiveBlending, depthWrite: false });
  world.add(new THREE.Points(bgGeo, bgMat));

  const layers = ['pn', 'kc', 'mbon'];
  const counts = layers.map((l) => pathway[l].length);
  const total = counts.reduce((a, b) => a + b, 0);
  const pos = new Float32Array(total * 3), col = new Float32Array(total * 3), act = new Float32Array(total), lay = new Float32Array(total);
  let k = 0;
  layers.forEach((l, li) => {
    for (const p of pathway[l]) {
      const v = toWorld(p[0], p[1], p[2]);
      pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z;
      const c = LAYER_COLOR[l]; col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      lay[k] = li; act[k] = 0; k++;
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aAct', new THREE.BufferAttribute(act, 1));
  geo.setAttribute('aLayer', new THREE.BufferAttribute(lay, 1));
  const W = WAVE_WINDOWS;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uWave: { value: 1 }, uPixelRatio: { value: renderer.getPixelRatio() }, uScale: { value: 300 } },
    vertexShader: `
      attribute float aAct; attribute float aLayer;
      uniform float uWave; uniform float uPixelRatio; uniform float uScale;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float w = aLayer < 0.5 ? smoothstep(${W.pn[0].toFixed(2)}, ${W.pn[1].toFixed(2)}, uWave)
                : aLayer < 1.5 ? smoothstep(${W.kc[0].toFixed(2)}, ${W.kc[1].toFixed(2)}, uWave)
                : smoothstep(${W.mbon[0].toFixed(2)}, ${W.mbon[1].toFixed(2)}, uWave);
        float glow = w * aAct;
        vColor = color;
        vAlpha = 0.22 + 0.78 * glow;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float base = aLayer > 1.5 ? 5.5 : aLayer < 0.5 ? 3.2 : 2.2;
        gl_PointSize = (base + 6.0 * glow) * uPixelRatio * (uScale / -mv.z) * 0.01;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5; float d = length(c);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.12, d) * vAlpha;
        gl_FragColor = vec4(vColor * (0.6 + 0.8 * vAlpha), a);
      }`,
  });
  world.add(new THREE.Points(geo, mat));

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    mat.uniforms.uScale.value = h;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // activation from a prediction's state vector: PN sigmoids, KC rates, |MBON| outputs
  function setActivation(state, model, animate) {
    if (!state || !model) return;
    const nPN = model.nPN, nKC = model.nKC, nMBON = model.nMBON;
    let kcMax = 0;
    for (let i = 0; i < nKC; i++) kcMax = Math.max(kcMax, state[nPN + i]);
    let activeKC = 0;
    let idx = 0;
    for (let i = 0; i < counts[0]; i++) act[idx++] = i < nPN ? state[i] : 0;
    for (let i = 0; i < counts[1]; i++) { const v = i < nKC ? state[nPN + i] : 0; if (v > 0) activeKC++; act[idx++] = kcMax > 0 ? Math.min(1, v / kcMax) : 0; }
    for (let i = 0; i < counts[2]; i++) act[idx++] = i < nMBON ? Math.abs(state[nPN + nKC + i]) : 0;
    geo.attributes.aAct.needsUpdate = true;
    onStats?.({ activeKC, nKC, nPN, nMBON, points: header.count });
    if (animate) { waveOn = true; waveStart = performance.now(); mat.uniforms.uWave.value = 0; lastPhase = ''; }
    else { waveOn = false; mat.uniforms.uWave.value = 1; onPhase?.('done'); }
  }

  function frame(now) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden || host.offsetParent === null) return;
    if (waveOn) {
      const t = Math.min(1, (now - waveStart) / WAVE_MS);
      mat.uniforms.uWave.value = 1 - Math.pow(1 - t, 2.2);
      const phase = t < W.kc[0] ? 'pn' : t < W.mbon[0] ? 'kc' : t < 1 ? 'mbon' : 'done';
      if (phase !== lastPhase) { lastPhase = phase; onPhase?.(phase); }
      if (t >= 1) waveOn = false;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  resize();
  raf = requestAnimationFrame(frame);

  function reset() { camera.position.copy(home); controls.target.set(0, 0, 0); controls.update(); }
  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
    bgGeo.dispose(); geo.dispose(); bgMat.dispose(); mat.dispose();
    renderer.dispose(); renderer.forceContextLoss?.(); renderer.domElement.remove();
  }
  return { setActivation, reset, dispose, setAutoRotate: (v) => { controls.autoRotate = v; } };
}
