// GAME-2 job scene: a quiet island. Nothing moves unless the game asks: one customer, one sale, one coin batch.
// Same look as GAME-1 (water, islands, belts, rounded parts). Interaction is DOM: the scene only positions
// elements that carry data-anchor="<id>" inside the overlay, so the 2D fallback keeps every control.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PEOPLE, type Build, type Job, type PartKind, type PersonId } from './jobs';

export type CoinKind = 'sim' | 'real' | 'mock';
export type LaneDest =
  | { type: 'person'; person: PersonId }   // Payout on NEAR
  | { type: 'vault' }
  | { type: 'portal' }
  | { type: 'gate' }                        // held at the Gate until release()
  | { type: 'nobody' };
export interface SalePlan { kind: CoinKind; lanes: { coins: number; dest: LaneDest; label?: string }[]; customer?: string }
export type PortalPhase = 'idle' | 'swirl' | 'beam' | 'pop' | 'failed';
export interface JobScene {
  setJob(job: Job): void;
  setBuild(build: Build): void;
  setGlow(sockets: string[], next: string | null): void;
  playSale(plan: SalePlan): Promise<void>;
  release(to: 'pass' | 'refund', dest: LaneDest): Promise<void>;
  customerLeave(): void;
  setPortal(phase: PortalPhase, kind: CoinKind): void;
  floater(anchor: string, html: string, cls?: string): void;
  hop(person: PersonId): void;
  relayout(): void;
  is2d: boolean;
  dispose(): void;
}
export interface SceneOpts { margins?: (w: number, h: number, portrait: boolean) => { t: number; b: number; l: number; r: number } }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
type V3 = THREE.Vector3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const FLOOR = 0.12, BELT_Y = FLOOR + 0.13;

// ------------------------------------------------------------------ layout (shared by 3D and 2D)
export interface Layout {
  stand: V3; customer: V3; hub: V3; lanes: { z: number; mid?: V3; key?: V3; end: V3 }[];
  people: Partial<Record<PersonId, V3>>; ethIsle: boolean; chiHome?: V3; exit: V3; fit: V3[];
}
export function layoutFor(job: Job): Layout {
  const zs = job.lanes === 3 ? [3, 0, -3] : [2.2, -2.2];
  const lanes = zs.map((z, i) => {
    const hasMid = job.sockets.some(s => s.role === 'mid' && s.lane === i);
    return { z, end: V(4.2, 0, z), mid: hasMid ? V(0.9, 0, z) : undefined, key: hasMid ? V(0.9, 0, z - 1.55) : undefined };
  });
  const people: Partial<Record<PersonId, V3>> = {};
  const ethIsle = job.n === 2;
  job.people.forEach((p, i) => { people[p] = V(6.6, 0, zs[Math.min(i, zs.length - 1)]); });
  let chiHome: V3 | undefined;
  if (ethIsle) { chiHome = people.chi; people.chi = V(15.6, 0, -7.4); }
  const customer = V(-9.9, 0, 1.1);
  people.customer = customer;
  const fit = [V(-11.2, 0, -1.8), V(-11.2, 0, 3.4), V(-8, 2.6, 0), V(7.8, 0, 4.4), V(7.8, 1.6, -4.4), V(-3, 0, 4.4), V(-3, 0, -4.4)];
  if (ethIsle) fit.push(V(18.6, 0, -10), V(18.8, 0, -4.4), V(15.6, 2, -7.4));
  return { stand: V(-7.6, 0, 0), customer, hub: V(-2.6, 0, 0), lanes, people, ethIsle, chiHome, exit: V(13.3, 0, -6.2), fit };
}

// ------------------------------------------------------------------ public factory
export let sceneIs2d = false;
export function createJobScene(canvas: HTMLCanvasElement, overlay: HTMLElement, opts: SceneOpts = {}): JobScene {
  const probe = document.createElement('canvas');
  if (new URLSearchParams(location.search).get('webgl') !== '0' && probe.getContext('webgl2')) {
    probe.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    try { const s = createWebGL(canvas, overlay, opts); sceneIs2d = false; return s; } catch { /* fall through to 2D */ }
  }
  sceneIs2d = true;
  return create2D(canvas, overlay, opts);
}

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ------------------------------------------------------------------ anchors (DOM positioning)
function placeAnchors(overlay: HTMLElement, project: (id: string) => { x: number; y: number; visible: boolean } | null) {
  const els = overlay.querySelectorAll<HTMLElement>('[data-anchor]');
  els.forEach(el => {
    const p = project(el.dataset.anchor!);
    if (!p || !p.visible) { el.style.visibility = 'hidden'; return; }
    el.style.visibility = '';
    el.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`;
  });
}
function anchorPoint(L: Layout, id: string): V3 | null {
  const [kind, key] = id.split(':');
  if (kind === 'socket') {
    if (key === 'hub') return L.hub.clone().setY(1.2);
    const lane = Number(key.slice(-1)); const ln = L.lanes[lane]; if (!ln) return null;
    if (key.startsWith('end')) return ln.end.clone().setY(1.25);
    if (key.startsWith('mid')) return ln.mid ? ln.mid.clone().setY(1.3) : null;
    if (key.startsWith('key')) return ln.key ? ln.key.clone().setY(0.9) : null;
  }
  if (kind === 'person') { const p = L.people[key as PersonId]; return p ? p.clone().setY(1.55) : null; }
  if (kind === 'stand') return L.stand.clone().setY(2.9);
  if (kind === 'home') return L.chiHome ? L.chiHome.clone().setY(1.2) : null;
  if (kind === 'portal') { const i = L.lanes.length - 1; return L.ethIsle ? L.lanes[i].end.clone().setY(1.0) : null; }
  if (kind === 'isle') return L.ethIsle ? V(16, 0, -2.8) : null;
  return null;
}

// ------------------------------------------------------------------ WebGL scene
function createWebGL(canvas: HTMLCanvasElement, overlay: HTMLElement, opts: SceneOpts): JobScene {
  const params = new URLSearchParams(location.search);
  const touch = matchMedia('(pointer: coarse)').matches;
  const low = params.get('lowfx') === '1';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !low; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#3f979d');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex; scene.environmentIntensity = 0.35;
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
  scene.add(new THREE.HemisphereLight('#fff7e8', '#4f9f98', 1.15));
  const sun = new THREE.DirectionalLight('#fff0d6', 3.3);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 120 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  sun.castShadow = !low; sun.shadow.mapSize.set(touch || low ? 1024 : 2048, touch || low ? 1024 : 2048);
  scene.add(sun, sun.target); sun.target.position.set(3, 0, -1); sun.position.set(-11, 26, -6);

  const disposables = new Set<{ dispose(): void }>();
  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const k = color + JSON.stringify(o);
    if (!matCache.has(k)) { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...o }); matCache.set(k, m); disposables.add(m); }
    return matCache.get(k)!;
  };
  const track = <T extends { dispose(): void }>(x: T) => { disposables.add(x); return x; };
  function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = scene) {
    track(geo); const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  function rbox(w: number, h: number, d: number, color: string | THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = scene, r = 0.12) {
    const m = typeof color === 'string' ? mat(color) : color;
    return mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)), m, x, y + h / 2, z, parent);
  }
  function group(x = 0, y = 0, z = 0, parent: THREE.Object3D = scene) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
  function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d')!; draw(ctx);
    const t = track(new THREE.CanvasTexture(cv)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return { t, redraw: () => { ctx.clearRect(0, 0, w, h); draw(ctx); t.needsUpdate = true; } };
  }
  function disposeTree(o: THREE.Object3D) {
    o.traverse(x => { const m = x as THREE.Mesh; if (m.geometry) { m.geometry.dispose(); disposables.delete(m.geometry); } });
    o.parent?.remove(o);
  }
  const springs = new Set<THREE.Object3D>();
  function springy(o: THREE.Object3D) { o.userData.sx = 0; o.userData.sv = 0; springs.add(o); return o; }
  function kick(o: THREE.Object3D, v = 4) { if (o.userData.sv !== undefined) o.userData.sv += v; }

  // ---------- water + islands (static) ----------
  const WATER_Y = -0.9;
  const isles = [new THREE.Vector4(-2, 0, 11.6, 7.4), new THREE.Vector4(16, -7.2, 4.4, 4.0)];
  const waterU = { t: { value: 0 }, isl: { value: isles } };
  const water = new THREE.Mesh(track(new THREE.PlaneGeometry(400, 400)), track(new THREE.ShaderMaterial({
    uniforms: waterU,
    vertexShader: `varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float t; uniform vec4 isl[2]; varying vec2 vW;
      float sdR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.)) + min(max(q.x,q.y),0.) - r; }
      void main(){
        float d = 1e9; for(int i=0;i<2;i++){ if(isl[i].z > 0.) d = min(d, sdR(vW - isl[i].xy, isl[i].zw, 1.6)); }
        vec3 deep = vec3(0.05,0.33,0.37), shallow = vec3(0.30,0.74,0.70);
        vec3 col = mix(shallow, deep, smoothstep(0.0, 5.0, d));
        col += 0.025*(sin(vW.x*0.9 + t*0.6)*sin(vW.y*1.1 - t*0.5));
        float foam = smoothstep(0.22, 0.0, d);
        col = mix(col, vec3(1.0), foam*0.85);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })));
  water.rotation.x = -Math.PI / 2; water.position.y = WATER_Y; scene.add(water);
  function island(cx: number, cz: number, hx: number, hz: number, top: string, cliff: string, low: string, parent: THREE.Object3D) {
    const w = hx * 2, d = hz * 2;
    rbox(w + 1.5, 0.32, d + 1.5, '#f6e3b4', cx, WATER_Y - 0.22, cz, parent, 0.7);
    rbox(w, 0.9, d, low, cx, WATER_Y - 0.1, cz, parent, 0.6);
    rbox(w - 0.1, 0.5, d - 0.1, cliff, cx, -0.57, cz, parent, 0.5);
    rbox(w, 0.4, d, top, cx, -0.38, cz, parent, 0.4);
  }
  island(-2, 0, 11.6 - 0.75, 7.4 - 0.75, '#8cc862', '#b8977a', '#987a60', scene);
  const ethGroup = group();
  island(16, -7.2, 3.65, 3.25, '#c3cbf2', '#7c86c4', '#5f69a8', ethGroup);
  rbox(5.6, FLOOR + 0.02, 5.0, '#eef0fc', 15.7, -0.02, -6.9, ethGroup, 0.9).castShadow = false;
  for (const [x, z, s] of [[18.8, -4.6, 1], [12.9, -9.6, 0.8], [19.2, -9.9, 1.2]] as const) {
    const c = mesh(new THREE.OctahedronGeometry(0.4 * s, 0), mat('#9aa8ff', { flatShading: true, roughness: 0.25, metalness: 0.2, emissive: '#3b4bd1', emissiveIntensity: 0.15 }), x, 0.38 * s, z, ethGroup);
    c.scale.y = 1.6;
  }
  // work floor
  {
    const g = canvasTex(256, 256, c => {
      c.fillStyle = '#f4ecdc'; c.fillRect(0, 0, 256, 256);
      c.strokeStyle = 'rgba(160,130,90,0.22)'; c.lineWidth = 4; c.strokeRect(0, 0, 256, 256);
    });
    g.t.wrapS = g.t.wrapT = THREE.RepeatWrapping; g.t.repeat.set(17, 10);
    rbox(17.2, FLOOR + 0.02, 10.4, mat('#ffffff', { map: g.t }), -1.6, -0.02, 0, scene, 0.18).castShadow = false;
    rbox(17.5, 0.1, 10.7, '#e1d3b8', -1.6, -0.04, 0, scene, 0.2).castShadow = false;
  }
  // decor
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  function tree(x: number, z: number, kind: number, s = 1) {
    const g = group(x, 0, z); g.scale.setScalar(s);
    rbox(0.14, 0.4, 0.14, '#8a5a3c', 0, 0, 0, g, 0.04);
    if (kind === 0) mesh(new THREE.ConeGeometry(0.42, 1.0, 7), mat('#3fae6a', { flatShading: true }), 0, 0.85, 0, g).rotation.y = rnd();
    else mesh(new THREE.IcosahedronGeometry(0.48, 1), mat(kind === 2 ? '#5bbf5f' : '#6fcf6a', { flatShading: true }), 0, 0.72, 0, g);
  }
  for (const [x, z, k, s] of [[-12.4, 6, 0, 1.1], [-11.6, 6.4, 1, 1], [-4, 6.5, 2, 0.9], [8.6, 6.2, 0, 1.1], [9, 4.8, 1, 0.9], [-6, -6.6, 0, 1], [1, -6.5, 0, 1.2], [9.2, -1, 0, 1], [-12.4, -5.4, 2, 0.9]] as const) tree(x, z, k, s);

  // ---------- characters ----------
  function character(id: PersonId) {
    const p = PEOPLE[id];
    const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
    mesh(new THREE.CapsuleGeometry(0.24, 0.26, 4, 12), mat(p.shirt), 0, 0.37, 0, body);
    mesh(new THREE.SphereGeometry(0.22, 18, 14), mat(p.skin), 0, 0.88, 0, body);
    const hair = mesh(new THREE.SphereGeometry(0.235, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(p.hair), 0, 0.9, -0.02, body); hair.scale.y = 0.8;
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.034, 6, 6), mat('#1d2433'), s * 0.08, 0.9, 0.2, body).castShadow = false;
    if (id === 'ada') { rbox(0.36, 0.14, 0.36, '#ffffff', 0, 1.06, 0, body, 0.06); mesh(new THREE.SphereGeometry(0.16, 12, 8), mat('#ffffff'), 0, 1.24, 0, body); }
    if (id === 'dayo') { const h = mesh(new THREE.SphereGeometry(0.26, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat('#ff8a3d'), 0, 0.93, 0, body); h.scale.y = 0.85; rbox(0.42, 0.34, 0.3, '#ffb020', 0, 0.3, -0.34, body, 0.05); }
    root.userData.body = body;
    scene.add(root);
    return root;
  }
  const chars = new Map<PersonId, THREE.Group>();
  const hops = new Map<PersonId, number>();

  // ---------- coins ----------
  const coinGeo = track(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 22));
  const coinMat = track(new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.55, roughness: 0.3, emissive: '#3a2a00', emissiveIntensity: 0.25 }));
  const MAX = 120;
  const coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, MAX); coinMesh.castShadow = true; coinMesh.frustumCulled = false; coinMesh.count = 0; scene.add(coinMesh);
  const KIND_COLOR: Record<CoinKind, THREE.Color> = { sim: new THREE.Color('#ffc53a'), real: new THREE.Color('#2ee6a8'), mock: new THREE.Color('#ff8a74') };
  type Leg = { kind: 'line'; pts: V3[]; speed: number } | { kind: 'arc'; to: V3; h: number; dur: number } | { kind: 'hold'; at: V3 } | { kind: 'wait'; dur: number };
  type Coin = { pos: V3; legs: Leg[]; li: number; t: number; from: V3; delay: number; color: THREE.Color; spin: number; done: () => void; hold?: boolean; gone?: boolean; gated?: boolean };
  const coins: Coin[] = [];
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = V(1, 1, 1), tmpV = V();
  function stepCoin(c: Coin, dt: number) {
    if (c.delay > 0) { c.delay -= dt; return; }
    const leg = c.legs[c.li];
    if (!leg) return;
    c.spin += dt * 6;
    if (leg.kind === 'hold') { c.pos.lerp(leg.at, Math.min(1, dt * 6)); if (!c.hold) { c.hold = true; c.done(); } return; }
    if (leg.kind === 'wait') { c.t += dt; if (c.t >= leg.dur) next(c); return; }
    if (leg.kind === 'line') {
      c.t += dt * leg.speed;
      let d = c.t, i = 0;
      for (; i < leg.pts.length - 1; i++) { const l = leg.pts[i].distanceTo(leg.pts[i + 1]); if (d <= l) { c.pos.lerpVectors(leg.pts[i], leg.pts[i + 1], l ? d / l : 1); return; } d -= l; }
      c.pos.copy(leg.pts[leg.pts.length - 1]); next(c); return;
    }
    c.t += dt / leg.dur;
    const k = Math.min(1, c.t), e = easeInOut(k);
    c.pos.lerpVectors(c.from, leg.to, e); c.pos.y += Math.sin(Math.PI * k) * leg.h;
    if (k >= 1) next(c);
  }
  function next(c: Coin) { c.li++; c.t = 0; c.from = c.pos.clone(); if (c.li >= c.legs.length) { c.gone = true; c.done(); } }
  function drawCoins() {
    let n = 0;
    for (const c of coins) {
      if (n >= MAX) break;
      if (c.delay > 0 && c.li === 0) continue;
      tmpE.set(Math.PI / 2 * 0.15 + Math.sin(c.spin) * 0.3, c.spin, 0); tmpQ.setFromEuler(tmpE);
      tmpM.compose(c.pos, tmpQ, tmpS); coinMesh.setMatrixAt(n, tmpM); coinMesh.setColorAt(n, c.color); n++;
    }
    coinMesh.count = n; coinMesh.instanceMatrix.needsUpdate = true; if (coinMesh.instanceColor) coinMesh.instanceColor.needsUpdate = true;
  }
  function spawn(from: V3, legs: Leg[], kind: CoinKind, delay: number, gated = false): Promise<void> {
    return new Promise(res => { coins.push({ pos: from.clone(), from: from.clone(), legs, li: 0, t: 0, delay, color: KIND_COLOR[kind], spin: Math.random() * 6, done: res, gated }); });
  }

  // ---------- particles / floaters ----------
  const pGeo = track(new THREE.BoxGeometry(0.08, 0.08, 0.08));
  const pMesh = new THREE.InstancedMesh(pGeo, track(new THREE.MeshBasicMaterial({ color: '#ffffff' })), 200); pMesh.frustumCulled = false; pMesh.count = 0; scene.add(pMesh);
  type P = { p: V3; v: V3; life: number; c: THREE.Color };
  const parts: P[] = [];
  function burst(at: V3, n: number, color: string) {
    for (let i = 0; i < n && parts.length < 200; i++) { const a = Math.random() * 6.28, s = 1 + Math.random() * 2; parts.push({ p: at.clone(), v: V(Math.cos(a) * s, 2 + Math.random() * 2, Math.sin(a) * s), life: 0.6 + Math.random() * 0.4, c: new THREE.Color(color) }); }
  }
  type Fl = { el: HTMLElement; at: V3; t: number };
  const floaters: Fl[] = [];
  function floaterAt(at: V3, html: string, cls = '') { const el = document.createElement('div'); el.className = 'j-floater ' + cls; el.innerHTML = html; overlay.appendChild(el); floaters.push({ el, at: at.clone(), t: 0 }); }

  // ---------- job-dependent world ----------
  let L: Layout | null = null;
  let jobRoot = group();
  let job: Job | null = null;
  const sockets = new Map<string, { g: THREE.Group; tile: THREE.Mesh; fill: THREE.Mesh; part: THREE.Object3D | null; kind: PartKind | null; sig: string }>();
  const belts: { tex: THREE.Texture; mat: THREE.MeshBasicMaterial }[] = [];
  let glow = new Set<string>(), nextSock: string | null = null;
  let splitDial: { redraw: () => void; shares: number[] } | null = null;
  let portalSwirl: THREE.ShaderMaterial | null = null, exitSwirl: THREE.ShaderMaterial | null = null;
  let portalPos: V3 | null = null;
  let customer: THREE.Group | null = null, custWant: V3 | null = null, custGone = true;
  const tileTex = canvasTex(256, 256, c => {
    c.strokeStyle = '#ffffff'; c.lineWidth = 12; c.setLineDash([26, 18]); c.lineCap = 'round';
    c.beginPath(); c.roundRect(14, 14, 228, 228, 40); c.stroke();
    c.setLineDash([]); c.lineWidth = 18; c.beginPath(); c.moveTo(128, 88); c.lineTo(128, 168); c.moveTo(88, 128); c.lineTo(168, 128); c.stroke();
  });
  const chevron = canvasTex(128, 128, c => { c.strokeStyle = 'rgba(150,160,190,0.55)'; c.lineWidth = 14; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(42, 34); c.lineTo(78, 64); c.lineTo(42, 94); c.stroke(); });
  const LANE_COLORS = ['#ffc53a', '#4fb3ff', '#ff6f91', '#7bd389'];

  function belt(pts: [number, number][], parent: THREE.Object3D) {
    const W = 0.66;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = V(pts[i][0], 0, pts[i][1]), e = V(pts[i + 1][0], 0, pts[i + 1][1]);
      const len = a.distanceTo(e); if (len < 0.01) continue;
      const mid = a.clone().add(e).multiplyScalar(0.5), ang = Math.atan2(-(e.z - a.z), e.x - a.x);
      const g = group(mid.x, FLOOR, mid.z, parent); g.rotation.y = ang;
      rbox(len + W, 0.1, W, '#2d3040', 0, 0, 0, g, 0.05);
      for (const s of [-1, 1]) rbox(len, 0.16, 0.07, '#ff8a3d', 0, 0, s * (W / 2 + 0.02), g, 0.03);
      const tex = chevron.t.clone(); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(len / 0.6, 1); tex.needsUpdate = true; track(tex);
      const m = track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      const pl = new THREE.Mesh(track(new THREE.PlaneGeometry(len, W * 0.8)), m); pl.rotation.x = -Math.PI / 2; pl.position.y = 0.102; g.add(pl);
      belts.push({ tex, mat: m });
    }
  }
  function stand(at: V3, parent: THREE.Object3D) {
    const g = springy(group(at.x, FLOOR, at.z, parent));
    rbox(1.6, 0.95, 2.1, '#ffd23f', 0, 0, 0, g, 0.16);
    rbox(1.66, 0.12, 2.16, '#f2b81c', 0, 0.95, 0, g, 0.05);
    for (let k = 0; k < 4; k++) rbox(0.05, 0.6, 0.05, '#ffffff', -0.6 + (k % 2) * 1.2, 1.05, (k < 2 ? -1 : 1) * 0.92, g, 0.02);
    const aw = group(0, 1.62, 0, g); aw.rotation.z = 0.22;
    for (let k = 0; k < 6; k++) rbox(1.8, 0.09, 0.4, k % 2 ? '#fff6ec' : '#c8553d', 0, 0, -1 + k * 0.4, aw, 0.04);
    for (const [x, z] of [[0.2, -0.5], [0.1, 0.1], [0.3, 0.6]]) { const b = mesh(new THREE.CapsuleGeometry(0.13, 0.3, 4, 10), mat('#d9954a'), x, 1.15, z, g); b.rotation.x = Math.PI / 2; }
    rbox(0.1, 0.34, 0.8, '#3a2c10', -0.81, 0.38, 0, g, 0.04);
    rbox(0.06, 0.07, 0.56, '#111', -0.86, 0.52, 0, g, 0.02);
    return g;
  }
  function makePart(kind: PartKind, laneColor: string): THREE.Group {
    const g = new THREE.Group();
    if (kind === 'Splitter') {
      rbox(1.5, 0.78, 2.1, '#2ec4b6', 0, 0, 0, g, 0.2);
      rbox(1.56, 0.1, 2.16, '#23a99c', 0, 0, 0, g, 0.05);
      const shares = splitDial?.shares ?? [];
      const pie = canvasTex(256, 256, c => {
        const sh = splitDial?.shares ?? shares; const tot = sh.reduce((a, b) => a + b, 0) || 1;
        c.fillStyle = '#e9fffb'; c.beginPath(); c.arc(128, 128, 126, 0, 7); c.fill();
        let a0 = -Math.PI / 2;
        sh.forEach((s, i) => { const a1 = a0 + (Math.PI * 2 * s) / tot; c.fillStyle = LANE_COLORS[i]; c.beginPath(); c.moveTo(128, 128); c.arc(128, 128, 112, a0, a1); c.fill(); a0 = a1; });
        c.fillStyle = '#e9fffb'; c.beginPath(); c.arc(128, 128, 46, 0, 7); c.fill();
      });
      splitDial = { redraw: pie.redraw, shares: splitDial?.shares ?? [] };
      const dial = mesh(new THREE.CylinderGeometry(0.66, 0.7, 0.12, 40), [mat('#e9fffb'), new THREE.MeshStandardMaterial({ map: pie.t, roughness: 0.6 }), mat('#e9fffb')] as unknown as THREE.Material, 0, 0.84, 0, g);
      dial.rotation.y = Math.PI / 2;
    } else if (kind === 'Payout') {
      rbox(0.16, 0.7, 0.16, '#3d4256', 0, 0, 0, g, 0.04);
      rbox(0.95, 0.66, 0.74, '#5fbf6f', 0, 0.66, 0, g, 0.2);
      rbox(0.08, 0.06, 0.42, '#1d2433', -0.48, 1.02, 0, g, 0.02);
      rbox(0.05, 0.42, 0.05, laneColor, 0.3, 1.22, 0.38, g, 0.02);
      rbox(0.24, 0.16, 0.04, laneColor, 0.42, 1.52, 0.38, g, 0.02);
    } else if (kind === 'Vault') {
      rbox(1.5, 0.3, 1.5, '#6f61b8', 0, 0, 0, g, 0.12);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rbox(0.18, 1.1, 0.18, '#4e4390', x * 0.66, 0.28, z * 0.66, g, 0.06);
      rbox(1.5, 0.12, 1.5, '#4e4390', 0, 1.36, 0, g, 0.06);
      const glass = new THREE.Mesh(track(new THREE.BoxGeometry(1.3, 1.05, 1.3)), track(new THREE.MeshStandardMaterial({ color: '#dff4ff', transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false })));
      glass.position.y = 0.82; g.add(glass);
    } else if (kind === 'Portal') {
      mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.3, 40), mat('#3a2f6b'), 0, 0.15, 0, g);
      const torus = mesh(new THREE.TorusGeometry(0.78, 0.15, 14, 48), mat('#8b5cf6', { emissive: '#8b5cf6', emissiveIntensity: 0.35, roughness: 0.4 }), 0, 0.32, 0, g);
      torus.rotation.x = Math.PI / 2;
      portalSwirl = swirl('#5b3bd6', '#4fd1ff');
      const disc = new THREE.Mesh(track(new THREE.CircleGeometry(0.7, 48)), portalSwirl); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.31; g.add(disc);
    } else if (kind === 'Gate') {
      rbox(1.7, 0.22, 1.3, '#3d4256', 0, 0, 0, g, 0.08);
      for (const s of [-1, 1]) rbox(0.22, 1.3, 0.22, '#ff8a3d', 0, 0.2, s * 0.62, g, 0.07);
      const bar = rbox(0.14, 0.14, 1.4, '#e8456f', 0, 0.95, 0, g, 0.06); g.userData.bar = bar;
      for (let k = -2; k <= 2; k++) rbox(0.15, 0.15, 0.12, k % 2 ? '#ffffff' : '#e8456f', 0, 0.95, k * 0.26, g, 0.03).visible = false;
    } else if (kind === 'Worker') {
      rbox(0.14, 0.5, 0.14, '#3d4256', 0, 0, 0, g, 0.04);
      const k = group(0, 0.8, 0, g);
      mesh(new THREE.TorusGeometry(0.17, 0.06, 10, 24), mat('#ffd23f', { metalness: 0.5, roughness: 0.3 }), 0, 0.12, 0, k);
      rbox(0.07, 0.45, 0.07, '#ffd23f', 0, -0.4, 0, k, 0.02);
      rbox(0.16, 0.07, 0.07, '#ffd23f', 0.07, -0.33, 0, k, 0.02);
      g.userData.spin = k;
    }
    g.traverse(o => { o.castShadow = true; });
    return g;
  }
  function swirl(c1: string, c2: string) {
    return track(new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, c1: { value: new THREE.Color(c1) }, c2: { value: new THREE.Color(c2) }, glow: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float t, glow; uniform vec3 c1, c2; varying vec2 vUv;
        void main(){ vec2 p = vUv*2.-1.; float r = length(p); float a = atan(p.y,p.x);
          float s = sin(a*3. + r*9. - t*(2.+glow*10.)); vec3 col = mix(c1, c2, smoothstep(-0.2,0.8,s)*(1.-r*0.6));
          col = mix(col, vec3(1.), smoothstep(0.38, 0.0, r)*(0.4+glow*0.6));
          gl_FragColor = vec4(col*(1.+glow*0.5), 1.);
          #include <colorspace_fragment>
        }`,
    }));
  }
  // exit portal + beam + gem (Ethereum island)
  const exitG = group(0, 0, 0, ethGroup);
  {
    mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.3, 40), mat('#2f3a7a'), 0, FLOOR + 0.15, 0, exitG);
    const t = mesh(new THREE.TorusGeometry(0.82, 0.15, 14, 48), mat('#6f7ff0', { emissive: '#6f7ff0', emissiveIntensity: 0.35 }), 0, FLOOR + 0.33, 0, exitG); t.rotation.x = Math.PI / 2;
    exitSwirl = swirl('#3949c9', '#9fb0ff');
    const d = new THREE.Mesh(track(new THREE.CircleGeometry(0.74, 48)), exitSwirl); d.rotation.x = -Math.PI / 2; d.position.y = FLOOR + 0.32; exitG.add(d);
  }
  const beamU = { head: { value: -1 }, fade: { value: 0 }, col: { value: new THREE.Color('#6a4cf0') } };
  const beamMat = track(new THREE.ShaderMaterial({
    uniforms: beamU, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float head, fade; uniform vec3 col; varying vec2 vUv;
      void main(){ float x = vUv.x; float trail = smoothstep(head-0.6, head, x) * step(x, head);
        float a = max(trail*0.95, 0.35*step(x, head)) * fade; gl_FragColor = vec4(mix(col, vec3(1.), trail*trail*0.8), a); }`,
  }));
  let beam: THREE.Mesh | null = null;
  const gemMat = track(new THREE.MeshStandardMaterial({ color: '#8d9bff', metalness: 0.35, roughness: 0.18, flatShading: true, emissive: '#2e3bc4', emissiveIntensity: 0.4 }));
  const gem = mesh(new THREE.OctahedronGeometry(0.24, 0), gemMat); gem.visible = false;
  let portalPhase: PortalPhase = 'idle', phaseT = 0, gemFrom = V(), gemTo = V();

  function setJob(j: Job) {
    job = j; L = layoutFor(j);
    disposeTree(jobRoot); jobRoot = group();
    for (const c of chars.values()) disposeTree(c);
    chars.clear(); sockets.clear(); belts.length = 0; splitDial = null; portalSwirl = null; portalPos = null; customer = null;
    coins.length = 0;
    const Lo = L;
    ethGroup.visible = Lo.ethIsle;
    isles[1].z = Lo.ethIsle ? 4.4 : 0;
    exitG.position.copy(Lo.exit);
    if (beam) { disposeTree(beam); beam = null; }
    gem.visible = false; portalPhase = 'idle';
    springy(stand(Lo.stand, jobRoot));
    // belts
    const H = Lo.hub;
    belt([[Lo.stand.x + 0.85, 0], [H.x - 0.8, 0]], jobRoot);
    Lo.lanes.forEach(ln => {
      const pts: [number, number][] = [[H.x + 0.75, ln.z * 0.25], [H.x + 1.3, ln.z * 0.25], [H.x + 1.3, ln.z], [ln.end.x - 0.6, ln.z]];
      belt(pts, jobRoot);
    });
    // sockets
    for (const s of j.sockets) {
      const p = s.id === 'hub' ? H : s.role === 'end' ? Lo.lanes[s.lane].end : s.role === 'mid' ? Lo.lanes[s.lane].mid! : Lo.lanes[s.lane].key!;
      const g = group(p.x, FLOOR + 0.03, p.z, jobRoot);
      const size = s.role === 'key' ? 1.0 : 1.7;
      const fillM = track(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.15, depthWrite: false }));
      const tileM = track(new THREE.MeshBasicMaterial({ map: tileTex.t, color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false }));
      const fill = new THREE.Mesh(track(new THREE.PlaneGeometry(size, size)), fillM); fill.rotation.x = -Math.PI / 2; g.add(fill);
      const tile = new THREE.Mesh(track(new THREE.PlaneGeometry(size, size)), tileM); tile.rotation.x = -Math.PI / 2; tile.position.y = 0.006; g.add(tile);
      if (s.role === 'key') { // little dashed link from key hook to its gate
        const l = rbox(0.08, 0.04, 0.9, '#ffd23f', 0, 0, 0.9, g, 0.02); l.castShadow = false;
      }
      sockets.set(s.id, { g, tile, fill, part: null, kind: null, sig: '' });
    }
    // people
    for (const id of [...j.people, 'customer' as PersonId]) {
      const c = character(id);
      if (id === 'customer') { customer = c; c.position.set(-13, FLOOR, 2.5); c.visible = false; custGone = true; continue; }
      c.position.copy(Lo.people[id]!).setY(FLOOR); c.rotation.y = -Math.PI / 2;
      springy(c.userData.body);
      chars.set(id, c);
    }
    if (Lo.chiHome) { // Chi's old spot on NEAR: a "moved abroad" sign
      const g = group(Lo.chiHome.x, FLOOR, Lo.chiHome.z, jobRoot);
      rbox(0.1, 0.9, 0.1, '#8a5a3c', 0, 0, 0, g, 0.03);
      rbox(0.9, 0.5, 0.08, '#fff6ec', 0, 0.75, 0, g, 0.04).rotation.y = -0.3;
    }
    if (Lo.ethIsle) {
      const from = Lo.lanes[Lo.lanes.length - 1].end.clone().setY(FLOOR + 0.5), to = Lo.exit.clone().setY(FLOOR + 0.5);
      const mid = from.clone().add(to).multiplyScalar(0.5).setY(5.5);
      beam = new THREE.Mesh(track(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, mid, to), 80, 0.1, 10)), beamMat);
      scene.add(beam); beamU.fade.value = 0;
      portalPos = from;
    }
    layoutCamera();
  }

  function setBuild(build: Build) {
    if (!job || !L) return;
    for (const s of job.sockets) {
      const rec = sockets.get(s.id)!; const p = build[s.id];
      const shares = p?.shares?.join(',') ?? '';
      const sig = p ? `${p.kind}` : '';
      if (p?.kind === 'Splitter') { if (!splitDial || splitDial.shares.join(',') !== shares) { splitDial = { ...(splitDial ?? { redraw: () => {} }), shares: p.shares!.slice() }; splitDial.redraw(); } }
      if (rec.sig === sig) continue;
      if (rec.part) { disposeTree(rec.part); rec.part = null; }
      rec.sig = sig; rec.kind = p?.kind ?? null;
      if (p) {
        if (p.kind === 'Splitter') splitDial = { redraw: () => {}, shares: p.shares!.slice() };
        const part = makePart(p.kind, LANE_COLORS[Math.max(0, s.lane)] ?? '#fff');
        if (p.kind === 'Splitter') splitDial!.redraw();
        part.position.copy(rec.g.position).setY(FLOOR);
        if (s.role === 'key') part.scale.setScalar(0.9);
        springy(part); kick(part, 7);
        jobRoot.add(part); rec.part = part;
        burst(part.position.clone().setY(0.6), 14, '#ffffff');
      }
      rec.tile.visible = rec.fill.visible = !p;
    }
  }

  // ---------- sale choreography ----------
  function lanePath(lane: number, untilMid: boolean): V3[] {
    const Lo = L!, H = Lo.hub, ln = Lo.lanes[lane], y = BELT_Y + 0.04;
    const pts = [V(H.x + 0.75, y, ln.z * 0.25), V(H.x + 1.3, y, ln.z * 0.25), V(H.x + 1.3, y, ln.z)];
    if (untilMid && ln.mid) pts.push(V(ln.mid.x - 0.7, y, ln.z), ln.mid.clone().setY(y + 0.3));
    else pts.push(V(ln.end.x - 0.6, y, ln.z), ln.end.clone().setY(y + 0.4));
    return pts;
  }
  let heldLane = -1;
  const destLegs = (dest: LaneDest, lane: number, i: number): Leg[] => {
    const Lo = L!;
    if (dest.type === 'person') {
      const at = Lo.people[dest.person] ?? Lo.chiHome; if (!at) return [];
      const to = (dest.person === 'chi' && Lo.chiHome) ? Lo.chiHome.clone().setY(0.5) : at.clone().setY(1.0);
      return [{ kind: 'arc', to, h: 1.6, dur: 0.55 }];
    }
    if (dest.type === 'vault') { const e = Lo.lanes[lane].end; return [{ kind: 'arc', to: V(e.x + (i % 3 - 1) * 0.3, FLOOR + 0.4 + Math.floor(i / 3) * 0.07, e.z + (Math.floor(i / 3) % 2 ? 0.2 : -0.2)), h: 0.8, dur: 0.4 }, { kind: 'hold', at: V(e.x + (i % 3 - 1) * 0.3, FLOOR + 0.42 + Math.floor(i / 3) * 0.07, e.z) }]; }
    if (dest.type === 'portal') { const e = Lo.lanes[lane].end; return [{ kind: 'arc', to: e.clone().setY(FLOOR + 0.2), h: 0.6, dur: 0.35 }]; }
    if (dest.type === 'gate') { const m = Lo.lanes[lane].mid!; const a = (i / 6) * Math.PI * 2; return [{ kind: 'hold', at: V(m.x + Math.cos(a) * 0.35, 1.9 + (i % 2) * 0.12, m.z + Math.sin(a) * 0.35) }]; }
    return [{ kind: 'arc', to: Lo.lanes[lane].end.clone().setY(-2), h: 0.4, dur: 0.6 }];
  };
  async function walkCustomerIn() {
    const Lo = L!; if (!customer) return;
    customer.visible = true; custGone = false;
    customer.position.set(Lo.customer.x - 2.6, FLOOR, Lo.customer.z + 1.8);
    custWant = Lo.customer.clone().setY(FLOOR);
    await wait(750);
  }
  async function playSale(plan: SalePlan) {
    if (!L || !job) return;
    const Lo = L;
    await walkCustomerIn();
    const kind = plan.kind;
    const total = plan.lanes.reduce((a, l) => a + l.coins, 0);
    // customer -> stand
    const standIn = Lo.stand.clone().setY(1.2).add(V(-0.7, 0, 0));
    await Promise.all(Array.from({ length: total }, (_, i) => spawn(Lo.customer.clone().setY(0.9), [{ kind: 'arc', to: standIn, h: 0.9, dur: 0.38 }], kind, i * 0.035)));
    const st = jobRoot.children[0]; kick(st, 5);
    // stand -> hub -> lanes
    const y = BELT_Y + 0.04;
    const main = [V(Lo.stand.x + 0.9, y, 0), V(Lo.hub.x - 0.2, y, 0)];
    const jobs: Promise<void>[] = [];
    let k = 0;
    plan.lanes.forEach((ln, lane) => {
      const gated = ln.dest.type === 'gate';
      const lp = lanePath(lane, gated);
      for (let i = 0; i < ln.coins; i++) {
        const legs: Leg[] = [{ kind: 'line', pts: [...main, ...lp], speed: 6.2 }, ...destLegs(ln.dest, lane, i)];
        jobs.push(spawn(main[0], legs, kind, (k++) * 0.07, gated).then(() => arrived(ln.dest, lane, i === ln.coins - 1, ln.label)));
      }
      if (gated) heldLane = lane;
    });
    await Promise.all(jobs);
    await wait(250);
  }
  function arrived(dest: LaneDest, lane: number, last: boolean, label?: string) {
    const Lo = L!;
    if (dest.type === 'person') {
      const c = chars.get(dest.person);
      if (c && !(dest.person === 'chi' && Lo.chiHome)) { kick(c.userData.body, 3); hops.set(dest.person, 0.35); }
      if (last && label) floaterAt((dest.person === 'chi' && Lo.chiHome ? Lo.chiHome : Lo.people[dest.person]!).clone().setY(2.1), label, 'good');
    } else if (dest.type === 'portal') {
      if (last) { const r = sockets.get(`end${lane}`)?.part; if (r) kick(r, 6); }
    } else if (dest.type === 'gate' && last) {
      floaterAt(Lo.lanes[lane].mid!.clone().setY(2.6), label ?? 'waiting', 'wait');
    } else if (dest.type === 'nobody' && last) floaterAt(Lo.lanes[lane].end.clone().setY(1.8), 'lost', 'bad');
  }
  async function release(to: 'pass' | 'refund', dest: LaneDest) {
    if (!L || heldLane < 0) return;
    const Lo = L, lane = heldLane;
    const held = coins.filter(c => !c.gone && c.gated);
    const gate = sockets.get(`mid${lane}`)?.part; const bar = gate?.userData.bar as THREE.Object3D | undefined;
    if (bar) bar.rotation.x = to === 'pass' ? -1.2 : 0;
    if (gate) kick(gate, 5);
    const ps = held.map((c, i) => new Promise<void>(res => {
      c.hold = false; c.gated = false; c.done = res; c.gone = false;
      const legs: Leg[] = to === 'pass'
        ? [{ kind: 'line', pts: [c.pos.clone(), Lo.lanes[lane].mid!.clone().setY(BELT_Y + 0.05), V(Lo.lanes[lane].end.x - 0.6, BELT_Y + 0.05, Lo.lanes[lane].z), Lo.lanes[lane].end.clone().setY(BELT_Y + 0.4)], speed: 5 }, ...destLegs(dest, lane, i)]
        : [{ kind: 'arc', to: Lo.customer.clone().setY(1.0), h: 3.2, dur: 1.0 }];
      c.legs = legs; c.li = 0; c.t = 0; c.from = c.pos.clone(); c.delay = i * 0.08;
    }));
    await Promise.all(ps);
    if (to === 'pass') arrived(dest, lane, true);
    if (bar) setTimeout(() => { bar.rotation.x = 0; }, 600);
    heldLane = -1;
    await wait(200);
  }
  function customerLeave() { if (customer && !custGone) { custWant = V(-13.5, FLOOR, -2.5); custGone = true; } }

  // ---------- camera ----------
  let portrait = false;
  const camDir = V();
  function layoutCamera() {
    const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight); portrait = h > w * 1.15;
    renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : touch ? 1.5 : 2));
    renderer.setSize(w, h, false);
    const az = THREE.MathUtils.degToRad(portrait ? 90 : 18), el = THREE.MathUtils.degToRad(portrait ? 58 : 44);
    camDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const pts = L?.fit ?? [V(-11, 0, -4), V(8, 0, 4)];
    const c0 = V(0, 0, 0);
    camera.position.copy(c0).addScaledVector(camDir, 80); camera.up.set(0, 1, 0); camera.lookAt(c0); camera.updateMatrixWorld();
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of pts) { const v = p.clone().applyMatrix4(camera.matrixWorldInverse); minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }
    const m = opts.margins?.(w, h, portrait) ?? { t: 20, b: 20, l: 20, r: 20 };
    const s = Math.max((maxX - minX) / Math.max(80, w - m.l - m.r), (maxY - minY) / Math.max(80, h - m.t - m.b));
    const cx = (minX + maxX) / 2 - ((m.l - m.r) / 2) * s, cy = (minY + maxY) / 2 - ((m.b - m.t) / 2) * s;
    const right = V(1, 0, 0).applyQuaternion(camera.quaternion), up = V(0, 1, 0).applyQuaternion(camera.quaternion);
    const tgt = c0.clone().addScaledVector(right, cx).addScaledVector(up, cy);
    camera.position.copy(tgt).addScaledVector(camDir, 80); camera.lookAt(tgt);
    camera.left = (-w / 2) * s; camera.right = (w / 2) * s; camera.top = (h / 2) * s; camera.bottom = (-h / 2) * s;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const project = (p: V3) => { tmpV.copy(p).project(camera); return { x: (tmpV.x * 0.5 + 0.5) * innerWidth, y: (-tmpV.y * 0.5 + 0.5) * innerHeight, visible: tmpV.z < 1 }; };

  // ---------- loop ----------
  let t = 0, raf = 0, last = performance.now(), disposed = false;
  function step(dt: number) {
    t += dt;
    waterU.t.value = t;
    for (const b of belts) b.tex.offset.x -= dt * 2.2 / 0.6;
    for (const [id, rec] of sockets) {
      const on = glow.has(id), nx = nextSock === id;
      const k = 0.5 + 0.5 * Math.sin(t * 5);
      (rec.tile.material as THREE.MeshBasicMaterial).opacity = nx ? 0.75 + 0.25 * k : on ? 0.7 : 0.35;
      (rec.fill.material as THREE.MeshBasicMaterial).opacity = nx ? 0.2 + 0.25 * k : on ? 0.22 : 0.06;
      (rec.tile.material as THREE.MeshBasicMaterial).color.set(nx ? '#ffe14d' : on ? '#2ee6c8' : '#ffffff');
      rec.tile.scale.setScalar(nx ? 1 + 0.05 * k : 1);
      const sp = rec.part?.userData.spin as THREE.Object3D | undefined; if (sp) sp.rotation.y += dt * 1.5;
    }
    for (const o of springs) {
      const u = o.userData; const a = -260 * u.sx - 14 * u.sv; u.sv += a * dt; u.sx += u.sv * dt;
      const s = THREE.MathUtils.clamp(u.sx, -0.35, 0.35); o.scale.set(1 + s * 0.6, 1 - s, 1 + s * 0.6);
    }
    for (const [id, h] of hops) { const c = chars.get(id); if (!c) continue; const nh = h - dt; c.userData.body.position.y = nh > 0 ? Math.sin((1 - nh / 0.35) * Math.PI) * 0.4 : 0; if (nh <= 0) hops.delete(id); else hops.set(id, nh); }
    for (const c of chars.values()) c.userData.body.rotation.y = Math.sin(t * 0.8 + c.position.z) * 0.12;
    if (customer && custWant) {
      const d = custWant.clone().sub(customer.position); const l = d.length();
      if (l > 0.02) { customer.position.addScaledVector(d.normalize(), Math.min(l, dt * 4.5)); customer.rotation.y = Math.atan2(d.x, d.z); customer.userData.body.position.y = Math.abs(Math.sin(t * 12)) * 0.08; }
      else { customer.userData.body.position.y = 0; customer.rotation.y = Math.PI / 2; if (custGone) { customer.visible = false; custWant = null; } }
    }
    for (const c of coins) stepCoin(c, dt);
    for (let i = coins.length - 1; i >= 0; i--) if (coins[i].gone) coins.splice(i, 1);
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; p.v.y -= 9 * dt; p.p.addScaledVector(p.v, dt); if (p.life <= 0) parts.splice(i, 1); }
    // portal
    phaseT += dt;
    const g = portalPhase === 'swirl' ? 1 : portalPhase === 'beam' ? 1.4 : 0;
    if (portalSwirl) { portalSwirl.uniforms.t.value = t; portalSwirl.uniforms.glow.value += (g - portalSwirl.uniforms.glow.value) * Math.min(1, dt * 4); }
    if (exitSwirl) { exitSwirl.uniforms.t.value = t; exitSwirl.uniforms.glow.value += ((portalPhase === 'beam' || portalPhase === 'pop' ? 1 : 0) - exitSwirl.uniforms.glow.value) * Math.min(1, dt * 3); }
    if (portalPhase === 'beam') { beamU.fade.value = Math.min(1, beamU.fade.value + dt * 3); beamU.head.value = Math.min(1.6, phaseT / 1.2); }
    else beamU.fade.value = Math.max(0, beamU.fade.value - dt * 2);
    if (gem.visible) {
      const k = Math.min(1, phaseT / 1.1); gem.position.lerpVectors(gemFrom, gemTo, easeInOut(k)); gem.position.y += Math.sin(Math.PI * k) * 2.2;
      gem.rotation.y += dt * 3;
    }
    // floaters
    for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.t += dt; const p = project(f.at); f.el.style.transform = `translate3d(${p.x}px, ${p.y - f.t * 40}px, 0)`; f.el.style.opacity = String(Math.max(0, 1 - Math.max(0, f.t - 1.4) / 0.6)); if (f.t > 2) { f.el.remove(); floaters.splice(i, 1); } }
  }
  function draw() {
    drawCoins();
    let n = 0; for (const p of parts) { tmpM.compose(p.p, tmpQ.identity(), tmpS.setScalar(Math.max(0.1, p.life))); pMesh.setMatrixAt(n, tmpM); pMesh.setColorAt(n, p.c); n++; }
    tmpS.set(1, 1, 1);
    pMesh.count = n; pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
    renderer.render(scene, camera);
    if (L) { const Lo = L; placeAnchors(overlay, id => { const p = anchorPoint(Lo, id); return p ? project(p) : null; }); }
  }
  function frame(now: number) {
    if (disposed) return;
    const real = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    let left = real; while (left > 1e-6) { const d = Math.min(1 / 30, left); step(d); left -= d; }
    draw();
    raf = requestAnimationFrame(frame);
  }
  const onResize = () => layoutCamera();
  addEventListener('resize', onResize);
  raf = requestAnimationFrame(n => { last = n; frame(n); });
  (window as unknown as { __ww2: unknown }).__ww2 = { renderScale: (ratio: number) => { renderer.setPixelRatio(Math.max(0.25, Math.min(1, ratio))); draw(); }, state: () => ({ coins: coins.length, held: coins.filter(c => c.gated).length, portal: portalPhase, gem: gem.visible, customer: customer?.visible ?? false }), advance: (s: number) => { for (let i = 0; i < Math.round(s * 30); i++) step(1 / 30); draw(); } };

  return {
    is2d: false,
    setJob, setBuild,
    setGlow(s, n) { glow = new Set(s); nextSock = n; },
    playSale, release, customerLeave,
    setPortal(phase) {
      if (phase === portalPhase) return;
      portalPhase = phase; phaseT = 0;
      if (phase === 'beam') beamU.head.value = 0;
      if (phase === 'pop' && L && portalPos) {
        const chi = L.people.chi ?? L.exit;
        gemFrom = L.exit.clone().setY(FLOOR + 0.6); gemTo = chi.clone().setY(1.35); gem.visible = true;
        burst(gemFrom, 24, '#9fb0ff');
        setTimeout(() => { const c = chars.get('chi'); if (c) { kick(c.userData.body, 4); hops.set('chi', 0.35); } }, 1100);
      }
      if (phase === 'idle') gem.visible = false;
    },
    floater(anchor, html, cls = '') { if (!L) return; const p = anchorPoint(L, anchor); if (p) floaterAt(p.clone().setY(p.y + 0.5), html, cls); },
    hop(person) { const c = chars.get(person); if (c) { kick(c.userData.body, 4); hops.set(person, 0.35); } },
    relayout: layoutCamera,
    dispose() {
      disposed = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize);
      for (const f of floaters) f.el.remove();
      scene.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mm = m.material; if (mm) (Array.isArray(mm) ? mm : [mm]).forEach(x => x.dispose()); });
      disposables.forEach(d => d.dispose()); envTex.dispose(); pmrem.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

// ------------------------------------------------------------------ 2D fallback (no WebGL): static diagram, same anchors
function create2D(canvas: HTMLCanvasElement, overlay: HTMLElement, opts: SceneOpts): JobScene {
  canvas.dataset.fallback = '2d';
  const c = canvas.getContext('2d');
  let L: Layout | null = null;
  const map = { sx: 1, ox: 0, oy: 0 };
  const P = (p: V3) => ({ x: map.ox + (p.x + p.z * 0.35) * map.sx, y: map.oy + (p.z * 0.6 - (p.y ?? 0) * 0.8) * map.sx, visible: true });
  function fit() {
    const w = innerWidth, h = innerHeight; canvas.width = w; canvas.height = h;
    if (!L) return;
    const m = opts.margins?.(w, h, h > w * 1.15) ?? { t: 20, b: 20, l: 20, r: 20 };
    const xs = L.fit.map(p => p.x + p.z * 0.35), ys = L.fit.map(p => p.z * 0.6);
    const sx = Math.min((w - m.l - m.r) / (Math.max(...xs) - Math.min(...xs)), (h - m.t - m.b) / (Math.max(...ys) - Math.min(...ys) + 2));
    map.sx = sx; map.ox = m.l - Math.min(...xs) * sx; map.oy = m.t + (h - m.t - m.b) / 2 - (Math.min(...ys) + Math.max(...ys)) / 2 * sx + sx;
    draw();
  }
  function draw() {
    if (!c) return;
    c.fillStyle = '#3f979d'; c.fillRect(0, 0, canvas.width, canvas.height);
    if (!L) return;
    const Lo = L;
    c.lineWidth = Math.max(6, map.sx * 0.5); c.lineCap = 'round'; c.strokeStyle = '#2d3040';
    const line = (a: V3, b: V3) => { const p = P(a), q = P(b); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke(); };
    line(Lo.stand, Lo.hub);
    for (const ln of Lo.lanes) { const corner = V(Lo.hub.x + 1.3, 0, ln.z); line(Lo.hub, corner); line(corner, ln.end); }
    const dot = (p: V3, r: number, col: string) => { const q = P(p); c.fillStyle = col; c.beginPath(); c.arc(q.x, q.y, r, 0, 7); c.fill(); };
    dot(Lo.stand, map.sx * 0.9, '#ffd23f');
    for (const [id, p] of Object.entries(Lo.people)) if (p && id !== 'customer') dot(p, map.sx * 0.45, PEOPLE[id as PersonId].shirt);
    if (Lo.ethIsle) dot(Lo.exit, map.sx * 0.8, '#6f7ff0');
    c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '13px sans-serif'; c.textAlign = 'left'; c.fillText('2D view · all controls work', 12, canvas.height - 12);
  }
  let raf = 0, disposed = false;
  const loop = () => { if (disposed) return; if (L) { const Lo = L; placeAnchors(overlay, id => { const p = anchorPoint(Lo, id); if (!p) return null; const q = P(p); if (innerWidth < 640 && id.startsWith('socket:key')) q.y -= 60; return q; }); } raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  addEventListener('resize', fit);
  return {
    is2d: true,
    setJob(j) { L = layoutFor(j); fit(); },
    setBuild() { draw(); },
    setGlow() { /* DOM sockets carry the highlight */ },
    async playSale() { await wait(900); },
    async release() { await wait(500); },
    customerLeave() { /* nothing animated */ },
    setPortal() { /* the HUD card shows the phase */ },
    floater(anchor, html, cls = '') {
      if (!L) return; const p = anchorPoint(L, anchor); if (!p) return;
      const q = P(p); const el = document.createElement('div'); el.className = 'j-floater ' + cls; el.innerHTML = html; el.style.transform = `translate3d(${q.x}px, ${q.y - 20}px, 0)`; overlay.appendChild(el); setTimeout(() => el.remove(), 1800);
    },
    hop() { /* static */ },
    relayout: fit,
    dispose() { disposed = true; cancelAnimationFrame(raf); removeEventListener('resize', fit); },
  };
}
