// GAME-3 job scene: the island is the star. The machine is a tree of sockets laid out from the build itself
// (chained Splitters, Gate exits, a Portal anywhere). Nothing moves unless the game asks: one customer, one sale,
// coins travelling flow by flow along the belts. Interaction is DOM: the scene only positions elements that carry
// data-anchor="<id>" inside the overlay, so the 2D fallback keeps every control.
import { sound } from './sound';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PEOPLE, activeSockets, type Build, type Job, type PartKind, type PersonId } from './jobs';

export type CoinKind = 'sim' | 'real' | 'mock';
export type LaneDest =
  | { type: 'person'; person: PersonId }   // Payout on NEAR (customer = refund)
  | { type: 'vault' }
  | { type: 'portal' }
  | { type: 'gate' }                        // held at the Gate until release()
  | { type: 'nobody' };
/** One stream of coins: socket path from the root ('r') to where it stops. */
export interface Flow { path: string[]; coins: number; dest: LaneDest; label?: string; tag?: string }
export interface SalePlan { kind: CoinKind; flows: Flow[]; cancelled?: () => boolean }
export type PortalPhase = 'idle' | 'swirl' | 'beam' | 'pop' | 'failed';
export interface World { people: PersonId[]; abroad?: PersonId }
export interface JobScene {
  setJob(job: Job, world: World): void;
  setBuild(build: Build): void;
  setGlow(sockets: string[], next: string | null): void;
  playSale(plan: SalePlan, onLand?: (f: Flow) => void): Promise<void>;
  release(gate: string, flows: Flow[], kind: CoinKind, onLand?: (f: Flow) => void): Promise<void>;
  customerLeave(): void;
  stopSim(): void;
  setPortal(phase: PortalPhase, kind: CoinKind): void;
  focus(mode: 'all' | 'portal' | 'test' | 'title'): void;
  floater(anchor: string, html: string, cls?: string): void;
  hop(person: PersonId): void;
  relayout(): void;
  is2d: boolean;
  dispose(): void;
}
export interface SceneOpts { margins?: (w: number, h: number, portrait: boolean, mode: 'all' | 'portal' | 'test' | 'title') => { t: number; b: number; l: number; r: number } }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
type V3 = THREE.Vector3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const FLOOR = 0.12, BELT_Y = FLOOR + 0.13;
const DEPTH_X = [-3.4, 0.5, 4.0];
const ISLE = { x: 14.4, z: 0, hx: 2.8, hz: 3.3 };

// ------------------------------------------------------------------ layout (shared by 3D and 2D)
export interface Layout {
  stand: V3; customer: V3;
  nodes: Record<string, V3>; keys: Record<string, V3>;
  edges: { from: string; to: string }[];
  people: Partial<Record<PersonId, V3>>; abroad?: PersonId; exit: V3; isle: boolean; homeSign?: V3;
  fit: V3[];
}
export function layoutFor(job: Job | null, build: Build, world: World): Layout {
  const nodes: Record<string, V3> = {}, keys: Record<string, V3> = {};
  const edges: { from: string; to: string }[] = [];
  const socks = job ? activeSockets(job, build) : [{ id: 'r', depth: 0, parent: null, role: 'node' as const }];
  const kids = new Map<string, string[]>();
  for (const s of socks) if (s.role === 'node' && s.parent) { kids.set(s.parent, [...(kids.get(s.parent) ?? []), s.id]); edges.push({ from: s.parent, to: s.id }); }
  const leaves: string[] = [];
  const dfs = (id: string) => { const k = kids.get(id); if (!k?.length) leaves.push(id); else k.forEach(dfs); };
  dfs('r');
  const N = leaves.length, sp = N > 1 ? Math.min(2.7, 8.8 / (N - 1)) : 0;
  const zOf = new Map<string, number>(); leaves.forEach((id, i) => zOf.set(id, ((N - 1) / 2) * sp - i * sp));
  const place = (id: string, depth: number): number => {
    const k = kids.get(id); const z = k?.length ? k.map(c => place(c, depth + 1)).reduce((a, b) => a + b, 0) / k.length : zOf.get(id)!;
    nodes[id] = V(DEPTH_X[Math.min(depth, 2)], 0, z); return z;
  };
  place('r', 0);
  for (const s of socks) if (s.role === 'key' && s.parent && nodes[s.parent]) { const g0 = nodes[s.parent]; keys[s.id] = V(g0.x - 1.25, 0, g0.z - 1.15); }
  const row = world.people.filter(p => p !== world.abroad);
  const people: Partial<Record<PersonId, V3>> = {};
  const ps = row.length > 1 ? Math.min(2.4, 7 / (row.length - 1)) : 0;
  row.forEach((p, i) => { people[p] = V(7.7, 0, ((row.length - 1) / 2) * ps - i * ps); });
  const isle = !!world.abroad;
  if (world.abroad) people[world.abroad] = V(ISLE.x + 0.9, 0, ISLE.z + 1.1);
  const customer = V(-9.9, 0, 1.1); people.customer = customer;
  const fit = [V(-11.4, 0, -2.2), V(-11.4, 0, 3.6), V(-8, 2.6, 0), V(9, 0, 4.4), V(9, 1.6, -4.4), V(-3, 0, 4.6), V(-3, 0, -4.6)];
  // The distant island is framed only during the Portal moment.
  const homeSign = world.abroad && job?.abroad ? V(7.7, 0, -((row.length) / 2) * ps - 0.6) : undefined;
  return { stand: V(-7.6, 0, 0), customer, nodes, keys, edges, people, abroad: world.abroad, exit: V(ISLE.x - 1.1, 0, ISLE.z - 1.0), isle, homeSign, fit };
}
/** Belt polyline (x,z) from a parent socket to a child socket. */
function edgePts(a: V3, b: V3): [number, number][] {
  if (Math.abs(a.z - b.z) < 0.01) return [[a.x + 0.8, a.z], [b.x - 0.75, b.z]];
  const xm = a.x + 1.15;
  return [[a.x + 0.8, a.z], [xm, a.z], [xm, b.z], [b.x - 0.75, b.z]];
}
function standPts(L: Layout): [number, number][] {
  const r = L.nodes.r; const xm = L.stand.x + 1.6;
  return Math.abs(r.z) < 0.01 ? [[L.stand.x + 0.85, 0], [r.x - 0.8, 0]] : [[L.stand.x + 0.85, 0], [xm, 0], [xm, r.z], [r.x - 0.8, r.z]];
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
  overlay.querySelectorAll<HTMLElement>('[data-anchor]').forEach(el => {
    const p = project(el.dataset.anchor!);
    if (!p || !p.visible) { el.style.visibility = 'hidden'; return; }
    el.style.visibility = '';
    el.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`;
  });
}
function anchorPoint(L: Layout, id: string): V3 | null {
  const i = id.indexOf(':'); const kind = i < 0 ? id : id.slice(0, i), key = i < 0 ? '' : id.slice(i + 1);
  if (kind === 'socket') {
    if (L.nodes[key]) return L.nodes[key].clone().setY(key === 'r' ? 1.3 : 1.15);
    if (L.keys[key]) return L.keys[key].clone().setY(0.9);
    return null;
  }
  if (kind === 'person') { const p = L.people[key as PersonId]; return p ? p.clone().setY(1.6) : null; }
  if (kind === 'stand') return L.stand.clone().setY(2.4);
  if (kind === 'home') return L.homeSign ? L.homeSign.clone().setY(1.2) : null;
  if (kind === 'isle') return L.isle ? V(ISLE.x, 0, ISLE.z - 2.6) : null;
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
  renderer.shadowMap.enabled = !low; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#3f979d');
  if (!low) scene.fog = new THREE.Fog('#3f979d', 95, 150);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex; scene.environmentIntensity = 0.35;
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
  scene.add(new THREE.HemisphereLight('#fff7e8', '#4f9f98', 1.15));
  const sun = new THREE.DirectionalLight('#fff0d6', 3.3);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
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
  const isles = [new THREE.Vector4(-2, 0, 11.6, 7.4), new THREE.Vector4(ISLE.x, ISLE.z, ISLE.hx + 0.75, ISLE.hz + 0.75)];
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
  function island(cx: number, cz: number, hx: number, hz: number, top: string, cliff: string, lowc: string, parent: THREE.Object3D) {
    const w = hx * 2, d = hz * 2;
    rbox(w + 1.5, 0.32, d + 1.5, '#f6e3b4', cx, WATER_Y - 0.22, cz, parent, 0.7);
    rbox(w, 0.9, d, lowc, cx, WATER_Y - 0.1, cz, parent, 0.6);
    rbox(w - 0.1, 0.5, d - 0.1, cliff, cx, -0.57, cz, parent, 0.5);
    rbox(w, 0.4, d, top, cx, -0.38, cz, parent, 0.4);
  }
  island(-2, 0, 11.6 - 0.75, 7.4 - 0.75, '#8cc862', '#b8977a', '#987a60', scene);
  const ethGroup = group();
  island(ISLE.x, ISLE.z, ISLE.hx, ISLE.hz, '#c3cbf2', '#7c86c4', '#5f69a8', ethGroup);
  rbox(ISLE.hx * 2 - 0.6, FLOOR + 0.02, ISLE.hz * 2 - 0.8, '#eef0fc', ISLE.x, -0.02, ISLE.z, ethGroup, 0.9).castShadow = false;
  for (const [x, z, s] of [[ISLE.x + 1.9, ISLE.z - 2.3, 1], [ISLE.x - 1.6, ISLE.z + 2.4, 0.8], [ISLE.x + 2.0, ISLE.z + 2.5, 1.2]] as const) {
    const c = mesh(new THREE.OctahedronGeometry(0.4 * s, 0), mat('#9aa8ff', { flatShading: true, roughness: 0.25, metalness: 0.2, emissive: '#3b4bd1', emissiveIntensity: 0.15 }), x, 0.38 * s, z, ethGroup);
    c.scale.y = 1.6;
  }
  // work floor
  {
    const gt = canvasTex(256, 256, c => {
      c.fillStyle = '#f4ecdc'; c.fillRect(0, 0, 256, 256);
      c.strokeStyle = 'rgba(160,130,90,0.22)'; c.lineWidth = 4; c.strokeRect(0, 0, 256, 256);
    });
    gt.t.wrapS = gt.t.wrapT = THREE.RepeatWrapping; gt.t.repeat.set(17, 10.5);
    rbox(17.2, FLOOR + 0.02, 10.8, mat('#ffffff', { map: gt.t }), -1.6, -0.02, 0, scene, 0.18).castShadow = false;
    rbox(17.5, 0.1, 11.1, '#e1d3b8', -1.6, -0.04, 0, scene, 0.2).castShadow = false;
  }
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  function tree(x: number, z: number, kind: number, s = 1) {
    const gg = group(x, 0, z); gg.scale.setScalar(s);
    rbox(0.14, 0.4, 0.14, '#8a5a3c', 0, 0, 0, gg, 0.04);
    if (kind === 0) mesh(new THREE.ConeGeometry(0.42, 1.0, 7), mat('#3fae6a', { flatShading: true }), 0, 0.85, 0, gg).rotation.y = rnd();
    else mesh(new THREE.IcosahedronGeometry(0.48, 1), mat(kind === 2 ? '#5bbf5f' : '#6fcf6a', { flatShading: true }), 0, 0.72, 0, gg);
  }
  for (const [x, z, k, s] of [[-12.4, 6.2, 0, 1.1], [-11.6, 6.6, 1, 1], [-4, 6.7, 2, 0.9], [8.9, 6.3, 0, 1.1], [9.2, 5.1, 1, 0.9], [-6, -6.8, 0, 1], [1, -6.7, 0, 1.2], [9.3, -5.6, 0, 1], [-12.4, -5.6, 2, 0.9]] as const) tree(x, z, k, s);

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
    if (id === 'you') mesh(new THREE.ConeGeometry(0.2, 0.3, 5), mat('#ffd23f', { metalness: 0.4, roughness: 0.3 }), 0, 1.22, 0, body);
    root.userData.body = body;
    scene.add(root);
    return root;
  }
  const chars = new Map<PersonId, THREE.Group>();
  const hops = new Map<PersonId, number>();

  // ---------- coins ----------
  const coinGeo = track(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 22));
  const coinMat = track(new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.55, roughness: 0.3, emissive: '#3a2a00', emissiveIntensity: 0.25 }));
  const MAX = 140;
  const coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, MAX); coinMesh.castShadow = true; coinMesh.frustumCulled = false; coinMesh.count = 0; scene.add(coinMesh);
  const KIND_COLOR: Record<CoinKind, THREE.Color> = { sim: new THREE.Color('#ffc53a'), real: new THREE.Color('#2ee6a8'), mock: new THREE.Color('#ff8a74') };
  type Leg = { kind: 'line'; pts: V3[]; speed: number } | { kind: 'arc'; to: V3; h: number; dur: number } | { kind: 'hold'; at: V3 } | { kind: 'wait'; dur: number };
  type Coin = { kind: CoinKind; pos: V3; legs: Leg[]; li: number; t: number; from: V3; delay: number; color: THREE.Color; spin: number; done: () => void; hold?: boolean; gone?: boolean; gate?: string; scale?: number };
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
  function next(c: Coin) { c.li++; c.t = 0; c.from = c.pos.clone(); if (c.li >= c.legs.length) { c.gone = true; if (!low) burst(c.pos, 4, '#ffe14d'); sound.play('coin'); c.done(); } }
  function drawCoins() {
    let n = 0;
    for (const c of coins) {
      if (n >= MAX) break;
      if (c.delay > 0 && c.li === 0) continue;
      tmpE.set(Math.PI / 2 * 0.15 + Math.sin(c.spin) * 0.3, c.spin, 0); tmpQ.setFromEuler(tmpE);
      tmpM.compose(c.pos, tmpQ, tmpS.setScalar(c.scale ?? 1)); coinMesh.setMatrixAt(n, tmpM); coinMesh.setColorAt(n, c.color); n++;
    }
    tmpS.set(1, 1, 1);
    coinMesh.count = n; coinMesh.instanceMatrix.needsUpdate = true; if (coinMesh.instanceColor) coinMesh.instanceColor.needsUpdate = true;
  }
  function spawn(from: V3, legs: Leg[], kind: CoinKind, delay: number, gate?: string): Promise<void> {
    if (coins.length >= MAX) return Promise.resolve();
    return new Promise(res => { coins.push({ kind, pos: from.clone(), from: from.clone(), legs, li: 0, t: 0, delay, color: KIND_COLOR[kind], spin: Math.random() * 6, done: res, gate }); });
  }

  // ---------- particles / floaters ----------
  const pGeo = track(new THREE.BoxGeometry(0.08, 0.08, 0.08));
  const pMesh = new THREE.InstancedMesh(pGeo, track(new THREE.MeshBasicMaterial({ color: '#ffffff' })), 220); pMesh.frustumCulled = false; pMesh.count = 0; scene.add(pMesh);
  type Pt = { p: V3; v: V3; life: number; c: THREE.Color };
  const parts: Pt[] = [];
  function burst(at: V3, n: number, color: string) {
    for (let i = 0; i < n && parts.length < 220; i++) { const a = Math.random() * 6.28, s = 1 + Math.random() * 2; parts.push({ p: at.clone(), v: V(Math.cos(a) * s, 2 + Math.random() * 2, Math.sin(a) * s), life: 0.6 + Math.random() * 0.4, c: new THREE.Color(color) }); }
  }
  type Fl = { el: HTMLElement; at: V3; t: number };
  const floaters: Fl[] = [];
  function floaterAt(at: V3, html: string, cls = '') { const el = document.createElement('div'); el.className = 'j-floater ' + cls; el.innerHTML = html; overlay.appendChild(el); floaters.push({ el, at: at.clone(), t: 0 }); }

  // ---------- job-dependent world ----------
  let L: Layout | null = null;
  let job: Job | null = null; let world: World = { people: [] };
  let staticRoot = group(), machineRoot = group();
  const tiles = new Map<string, { g: THREE.Group; tile: THREE.Mesh; fill: THREE.Mesh }>();
  const partMeshes = new Map<string, { o: THREE.Object3D; kind: PartKind; socket: string; want: V3; dial?: { redraw: () => void; shares: number[] } }>();
  const belts: { tex: THREE.Texture }[] = [];
  let glow = new Set<string>(), nextSock: string | null = null;
  let portalSwirl: THREE.ShaderMaterial | null = null, exitSwirl: THREE.ShaderMaterial | null = null;
  let portalSock: string | null = null, beamKey = '';
  let customer: THREE.Group | null = null, custWant: V3 | null = null, custGone = true;
  let standG: THREE.Object3D | null = null;
  const tileTex = canvasTex(256, 256, c => {
    c.strokeStyle = '#ffffff'; c.lineWidth = 12; c.setLineDash([26, 18]); c.lineCap = 'round';
    c.beginPath(); c.roundRect(14, 14, 228, 228, 40); c.stroke();
    c.setLineDash([]); c.lineWidth = 18; c.beginPath(); c.moveTo(128, 88); c.lineTo(128, 168); c.moveTo(88, 128); c.lineTo(168, 128); c.stroke();
  });
  const chevron = canvasTex(128, 128, c => { c.strokeStyle = 'rgba(150,160,190,0.55)'; c.lineWidth = 14; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(42, 34); c.lineTo(78, 64); c.lineTo(42, 94); c.stroke(); });
  const LANE_COLORS = ['#ffc53a', '#4fb3ff', '#ff6f91', '#7bd389'];

  function belt(pts: [number, number][], parent: THREE.Object3D, color = '#ff8a3d') {
    const W = 0.62;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = V(pts[i][0], 0, pts[i][1]), e = V(pts[i + 1][0], 0, pts[i + 1][1]);
      const len = a.distanceTo(e); if (len < 0.01) continue;
      const mid = a.clone().add(e).multiplyScalar(0.5), ang = Math.atan2(-(e.z - a.z), e.x - a.x);
      const gg = group(mid.x, FLOOR, mid.z, parent); gg.rotation.y = ang;
      rbox(len + W, 0.1, W, '#2d3040', 0, 0, 0, gg, 0.05);
      for (const s of [-1, 1]) rbox(len, 0.16, 0.07, color, 0, 0, s * (W / 2 + 0.02), gg, 0.03);
      const tex = chevron.t.clone(); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(len / 0.6, 1); tex.needsUpdate = true; track(tex);
      const m = track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      const pl = new THREE.Mesh(track(new THREE.PlaneGeometry(len, W * 0.8)), m); pl.rotation.x = -Math.PI / 2; pl.position.y = 0.102; gg.add(pl);
      belts.push({ tex });
    }
  }
  function stand(at: V3, parent: THREE.Object3D) {
    const gg = springy(group(at.x, FLOOR, at.z, parent));
    rbox(1.6, 0.95, 2.1, '#ffd23f', 0, 0, 0, gg, 0.16);
    rbox(1.66, 0.12, 2.16, '#f2b81c', 0, 0.95, 0, gg, 0.05);
    for (let k = 0; k < 4; k++) rbox(0.05, 0.6, 0.05, '#ffffff', -0.6 + (k % 2) * 1.2, 1.05, (k < 2 ? -1 : 1) * 0.92, gg, 0.02);
    const aw = group(0, 1.62, 0, gg); aw.rotation.z = 0.22;
    for (let k = 0; k < 6; k++) rbox(1.8, 0.09, 0.4, k % 2 ? '#fff6ec' : '#c8553d', 0, 0, -1 + k * 0.4, aw, 0.04);
    for (const [x, z] of [[0.2, -0.5], [0.1, 0.1], [0.3, 0.6]]) { const b = mesh(new THREE.CapsuleGeometry(0.13, 0.3, 4, 10), mat('#d9954a'), x, 1.15, z, gg); b.rotation.x = Math.PI / 2; }
    rbox(0.1, 0.34, 0.8, '#3a2c10', -0.81, 0.38, 0, gg, 0.04);
    rbox(0.06, 0.07, 0.56, '#111', -0.86, 0.52, 0, gg, 0.02);
    return gg;
  }
  function makePart(kind: PartKind, laneColor: string, shares?: number[]): { g: THREE.Group; dial?: { redraw: () => void; shares: number[] } } {
    const gg = new THREE.Group(); let dial: { redraw: () => void; shares: number[] } | undefined;
    if (kind === 'Splitter') {
      rbox(1.4, 0.74, 1.8, '#2ec4b6', 0, 0, 0, gg, 0.2);
      rbox(1.46, 0.1, 1.86, '#23a99c', 0, 0, 0, gg, 0.05);
      const d = { shares: shares?.slice() ?? [], redraw: () => {} };
      const pie = canvasTex(256, 256, c => {
        const sh = d.shares; const tot = sh.reduce((a, b) => a + b, 0) || 1;
        c.fillStyle = '#e9fffb'; c.beginPath(); c.arc(128, 128, 126, 0, 7); c.fill();
        let a0 = -Math.PI / 2;
        sh.forEach((s, i) => { const a1 = a0 + (Math.PI * 2 * s) / tot; c.fillStyle = LANE_COLORS[i]; c.beginPath(); c.moveTo(128, 128); c.arc(128, 128, 112, a0, a1); c.fill(); a0 = a1; });
        c.fillStyle = '#e9fffb'; c.beginPath(); c.arc(128, 128, 46, 0, 7); c.fill();
      });
      d.redraw = pie.redraw; dial = d;
      const dm = mesh(new THREE.CylinderGeometry(0.6, 0.64, 0.12, 40), [mat('#e9fffb'), track(new THREE.MeshStandardMaterial({ map: pie.t, roughness: 0.6 })), mat('#e9fffb')] as unknown as THREE.Material, 0, 0.8, 0, gg);
      dm.rotation.y = Math.PI / 2;
    } else if (kind === 'Payout') {
      rbox(0.16, 0.7, 0.16, '#3d4256', 0, 0, 0, gg, 0.04);
      rbox(0.95, 0.66, 0.74, '#5fbf6f', 0, 0.66, 0, gg, 0.2);
      rbox(0.08, 0.06, 0.42, '#1d2433', -0.48, 1.02, 0, gg, 0.02);
      rbox(0.05, 0.42, 0.05, laneColor, 0.3, 1.22, 0.38, gg, 0.02);
      rbox(0.24, 0.16, 0.04, laneColor, 0.42, 1.52, 0.38, gg, 0.02);
    } else if (kind === 'Vault') {
      rbox(1.4, 0.3, 1.4, '#6f61b8', 0, 0, 0, gg, 0.12);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rbox(0.18, 1.1, 0.18, '#4e4390', x * 0.6, 0.28, z * 0.6, gg, 0.06);
      rbox(1.4, 0.12, 1.4, '#4e4390', 0, 1.36, 0, gg, 0.06);
      const glass = new THREE.Mesh(track(new THREE.BoxGeometry(1.2, 1.05, 1.2)), track(new THREE.MeshStandardMaterial({ color: '#dff4ff', transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false })));
      glass.position.y = 0.82; gg.add(glass);
    } else if (kind === 'Portal') {
      mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.3, 40), mat('#3a2f6b'), 0, 0.15, 0, gg);
      const torus = mesh(new THREE.TorusGeometry(0.78, 0.15, 14, 48), mat('#8b5cf6', { emissive: '#8b5cf6', emissiveIntensity: 0.35, roughness: 0.4 }), 0, 0.32, 0, gg);
      torus.rotation.x = Math.PI / 2;
      portalSwirl = swirl('#5b3bd6', '#4fd1ff');
      const disc = new THREE.Mesh(track(new THREE.CircleGeometry(0.7, 48)), portalSwirl); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.31; gg.add(disc);
    } else if (kind === 'Gate') {
      rbox(1.5, 0.22, 1.3, '#3d4256', 0, 0, 0, gg, 0.08);
      for (const s of [-1, 1]) rbox(0.22, 1.3, 0.22, '#ff8a3d', 0, 0.2, s * 0.62, gg, 0.07);
      const bar = rbox(0.14, 0.14, 1.4, '#e8456f', 0, 0.95, 0, gg, 0.06); gg.userData.bar = bar;
    } else if (kind === 'Worker') {
      rbox(0.14, 0.5, 0.14, '#3d4256', 0, 0, 0, gg, 0.04);
      const k = group(0, 0.8, 0, gg);
      mesh(new THREE.TorusGeometry(0.17, 0.06, 10, 24), mat('#ffd23f', { metalness: 0.5, roughness: 0.3 }), 0, 0.12, 0, k);
      rbox(0.07, 0.45, 0.07, '#ffd23f', 0, -0.4, 0, k, 0.02);
      rbox(0.16, 0.07, 0.07, '#ffd23f', 0.07, -0.33, 0, k, 0.02);
      gg.userData.spin = k;
    }
    gg.traverse(o => { o.castShadow = true; });
    return { g: gg, dial };
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
  const gem = mesh(new THREE.OctahedronGeometry(0.26, 0), gemMat); gem.visible = false;
  let portalPhase: PortalPhase = 'idle', phaseT = 0, gemFrom = V(), gemTo = V(), diveT = 0, diveKind: CoinKind = 'sim';

  function setJob(j: Job, w: World) {
    job = j; world = w;
    disposeTree(staticRoot); staticRoot = group();
    for (const c of chars.values()) disposeTree(c);
    if (customer) disposeTree(customer);
    chars.clear(); coins.length = 0; customer = null;
    L = layoutFor(j, { r: null }, w);
    const Lo = L;
    ethGroup.visible = Lo.isle; isles[1].z = Lo.isle ? ISLE.hx + 0.75 : 0;
    exitG.position.copy(Lo.exit);
    gem.visible = false; portalPhase = 'idle';
    standG = stand(Lo.stand, staticRoot);
    for (const id of [...w.people, 'customer' as PersonId]) {
      const c = character(id);
      if (id === 'customer') { customer = c; c.position.set(-13, FLOOR, 2.5); c.visible = false; custGone = true; continue; }
      c.position.copy(Lo.people[id]!).setY(FLOOR); c.rotation.y = -Math.PI / 2;
      springy(c.userData.body);
      chars.set(id, c);
    }
    if (Lo.homeSign) {
      const gg = group(Lo.homeSign.x, FLOOR, Lo.homeSign.z, staticRoot);
      rbox(0.1, 0.9, 0.1, '#8a5a3c', 0, 0, 0, gg, 0.03);
      rbox(0.9, 0.5, 0.08, '#fff6ec', 0, 0.75, 0, gg, 0.04).rotation.y = -0.3;
    }
    for (const pm of partMeshes.values()) disposeTree(pm.o);
    partMeshes.clear(); portalSock = null; beamKey = '';
    setBuild({ r: null });
    layoutCamera(true);
  }

  let build: Build = { r: null };
  function setBuild(b: Build) {
    if (!job) return;
    build = b;
    L = layoutFor(job, b, world);
    const Lo = L;
    // belts + tiles are cheap: rebuild them
    disposeTree(machineRoot); machineRoot = group(); belts.length = 0; tiles.clear();
    belt(standPts(Lo), machineRoot);
    for (const e of Lo.edges) belt(edgePts(Lo.nodes[e.from], Lo.nodes[e.to]), machineRoot, e.to.endsWith('.f') ? '#e8456f' : e.to.endsWith('.p') ? '#3fae5a' : '#ff8a3d');
    const all = { ...Lo.nodes, ...Lo.keys };
    for (const [id, p] of Object.entries(all)) {
      const gg = group(p.x, FLOOR + 0.03, p.z, machineRoot);
      const size = Lo.keys[id] ? 0.95 : 1.5;
      const fill = new THREE.Mesh(track(new THREE.PlaneGeometry(size, size)), track(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.15, depthWrite: false }))); fill.rotation.x = -Math.PI / 2; gg.add(fill);
      const tile = new THREE.Mesh(track(new THREE.PlaneGeometry(size, size)), track(new THREE.MeshBasicMaterial({ map: tileTex.t, color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false }))); tile.rotation.x = -Math.PI / 2; tile.position.y = 0.006; gg.add(tile);
      if (Lo.keys[id]) { const gp = Lo.nodes[id.slice(0, -2)]; if (gp) { const l = rbox(0.06, 0.04, gp.distanceTo(p), '#ffd23f', (gp.x - p.x) / 2, 0, (gp.z - p.z) / 2, gg, 0.02); l.rotation.y = Math.atan2(gp.x - p.x, gp.z - p.z); l.castShadow = false; } }
      const filled = !!b[id];
      tile.visible = fill.visible = !filled;
      tiles.set(id, { g: gg, tile, fill });
    }
    // parts keyed by uid: keep meshes, move them to their new spot
    const seen = new Set<string>();
    portalSock = null;
    for (const [id, p] of Object.entries(all)) {
      const pl = b[id]; if (!pl) continue;
      seen.add(pl.uid);
      const lane = Number(id.split('.')[1] ?? 0) || 0;
      let rec = partMeshes.get(pl.uid);
      if (rec && rec.kind !== pl.kind) { disposeTree(rec.o); partMeshes.delete(pl.uid); rec = undefined; }
      if (!rec) {
        const made = makePart(pl.kind, LANE_COLORS[lane % 4]);
        made.g.position.copy(p).setY(FLOOR);
        springy(made.g); kick(made.g, 7);
        scene.add(made.g);
        rec = { o: made.g, kind: pl.kind, socket: id, want: p.clone().setY(FLOOR), dial: made.dial };
        partMeshes.set(pl.uid, rec);
        burst(p.clone().setY(0.6), 14, '#ffffff');
      }
      rec.socket = id; rec.want = p.clone().setY(FLOOR);
      const depth = id.split('.').length - 1;
      rec.o.userData.base = Lo.keys[id] ? 0.9 : depth >= 2 ? 0.82 : depth === 1 && pl.kind === 'Splitter' ? 0.86 : 1;
      if (rec.dial && pl.shares && rec.dial.shares.join(',') !== pl.shares.join(',')) { rec.dial.shares = pl.shares.slice(); rec.dial.redraw(); }
      if (pl.kind === 'Portal') portalSock = id;
    }
    for (const [uid, rec] of partMeshes) if (!seen.has(uid)) { disposeTree(rec.o); partMeshes.delete(uid); if (rec.kind === 'Portal') portalSwirl = null; }
    // beam from the Portal (wherever it sits) across the water to the island exit
    const key = portalSock && Lo.isle ? `${portalSock}@${Lo.nodes[portalSock].x},${Lo.nodes[portalSock].z}` : '';
    if (key !== beamKey) {
      if (beam) { disposeTree(beam); beam = null; }
      beamKey = key;
      if (key) {
        const from = Lo.nodes[portalSock!].clone().setY(FLOOR + 0.5), to = Lo.exit.clone().setY(FLOOR + 0.5);
        const mid = from.clone().add(to).multiplyScalar(0.5).setY(5.5);
        beam = new THREE.Mesh(track(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, mid, to), 80, 0.1, 10)), beamMat);
        scene.add(beam); beamU.fade.value = 0;
      }
    }
  }

  // ---------- sale choreography ----------
  const nodeAt = (id: string) => L!.nodes[id];
  function pathPts(path: string[], fromStand: boolean, stopAtLast: boolean): V3[] {
    const Lo = L!, y = BELT_Y + 0.04;
    const pts: V3[] = [];
    if (fromStand) for (const [x, z] of standPts(Lo)) pts.push(V(x, y, z));
    for (let i = 0; i < path.length; i++) {
      const p = nodeAt(path[i]); if (!p) break;
      if (i > 0) for (const [x, z] of edgePts(nodeAt(path[i - 1]), p)) pts.push(V(x, y, z));
      if (i < path.length - 1 || !stopAtLast) pts.push(p.clone().setY(y + 0.15));
    }
    return pts;
  }
  const destLegs = (f: Flow, i: number): Leg[] => {
    const Lo = L!; const end = nodeAt(f.path[f.path.length - 1]);
    const d = f.dest;
    if (d.type === 'person') {
      const at = Lo.people[d.person]; if (!at) return [];
      return [{ kind: 'arc', to: d.person === 'customer' ? Lo.customer.clone().setY(1.0) : at.clone().setY(1.0), h: d.person === 'customer' ? 3.0 : 1.6, dur: d.person === 'customer' ? 0.9 : 0.55 }];
    }
    if (d.type === 'vault') return [{ kind: 'arc', to: V(end.x + (i % 3 - 1) * 0.3, FLOOR + 0.4, end.z + (Math.floor(i / 3) % 2 ? 0.2 : -0.2)), h: 0.8, dur: 0.4 }, { kind: 'hold', at: V(end.x + (i % 3 - 1) * 0.3, FLOOR + 0.42 + Math.floor(i / 3) * 0.07, end.z) }];
    if (d.type === 'portal') return [{ kind: 'arc', to: end.clone().setY(FLOOR + 0.2), h: 0.6, dur: 0.35 }];
    if (d.type === 'gate') { const a = (i / 6) * Math.PI * 2; return [{ kind: 'hold', at: V(end.x + Math.cos(a) * 0.35, 1.9 + (i % 2) * 0.12, end.z + Math.sin(a) * 0.35) }]; }
    return [{ kind: 'arc', to: end.clone().setY(-2), h: 0.4, dur: 0.6 }];
  };
  async function walkCustomerIn() {
    const Lo = L!; if (!customer) return;
    customer.visible = true; custGone = false;
    customer.position.set(Lo.customer.x - 2.6, FLOOR, Lo.customer.z + 1.8);
    custWant = Lo.customer.clone().setY(FLOOR);
    await wait(700);
  }
  async function runFlows(flows: Flow[], kind: CoinKind, start: (f: Flow) => { from: V3; pts: V3[]; gate?: string }, onLand?: (f: Flow) => void) {
    let k = 0;
    const all: Promise<void>[] = [];
    flows.forEach((f, fi) => {
      const s = start(f);
      const ps: Promise<void>[] = [];
      for (let i = 0; i < f.coins; i++) ps.push(spawn(s.from, [{ kind: 'line', pts: s.pts, speed: 6.4 }, ...destLegs(f, i)], kind, fi * 0.45 + (k++) * 0.05, f.dest.type === 'gate' ? f.path[f.path.length - 1] : undefined));
      all.push(Promise.all(ps).then(() => { arrived(f); onLand?.(f); }));
    });
    await Promise.all(all);
  }
  async function playSale(plan: SalePlan, onLand?: (f: Flow) => void) {
    if (!L || !job) return;
    const Lo = L;
    await walkCustomerIn();
    if (plan.cancelled?.()) return;
    const total = plan.flows.reduce((a, f) => a + f.coins, 0);
    const standIn = Lo.stand.clone().setY(1.2).add(V(-0.7, 0, 0));
    await Promise.all(Array.from({ length: total }, (_, i) => spawn(Lo.customer.clone().setY(0.9), [{ kind: 'arc', to: standIn, h: 0.9, dur: 0.38 }], plan.kind, i * 0.03)));
    if (plan.cancelled?.()) return;
    if (standG) kick(standG, 5);
    await runFlows(plan.flows, plan.kind, f => { const pts = pathPts(f.path, true, f.dest.type === 'gate'); return { from: pts[0], pts }; }, onLand);
    await wait(200);
  }
  function arrived(f: Flow) {
    const Lo = L!; const d = f.dest;
    if (d.type === 'person') {
      const c = chars.get(d.person);
      if (c) { kick(c.userData.body, 3); hops.set(d.person, 0.35); }
      if (f.label) floaterAt((Lo.people[d.person] ?? Lo.customer).clone().setY(2.2), f.label, d.person === 'customer' ? 'good' : 'good');
    } else if (d.type === 'portal') {
      const r = [...partMeshes.values()].find(p => p.kind === 'Portal'); if (r) kick(r.o, 6);
    } else if (d.type === 'gate') floaterAt(nodeAt(f.path[f.path.length - 1]).clone().setY(2.7), f.label ?? 'waiting', 'wait');
    else if (d.type === 'vault' && f.label) floaterAt(nodeAt(f.path[f.path.length - 1]).clone().setY(2.0), f.label, 'bad');
    else if (d.type === 'nobody') floaterAt(nodeAt(f.path[f.path.length - 1]).clone().setY(1.8), 'lost', 'bad');
  }
  async function release(gate: string, flows: Flow[], kind: CoinKind, onLand?: (f: Flow) => void) {
    if (!L) return;
    const held = coins.filter(c => !c.gone && c.gate === gate);
    for (const c of held) { c.gone = true; c.done = () => {}; }
    for (let i = coins.length - 1; i >= 0; i--) if (coins[i].gone) coins.splice(i, 1);
    const rec = [...partMeshes.values()].find(p => p.socket === gate);
    const bar = rec?.o.userData.bar as THREE.Object3D | undefined;
    const pass = flows.some(f => f.path.some(s => s.startsWith(gate + '.p')));
    if (bar) bar.rotation.x = pass ? -1.2 : 0;
    if (rec) kick(rec.o, 5);
    await runFlows(flows, kind, f => { const pts = pathPts(f.path, false, false); return { from: nodeAt(gate).clone().setY(1.9), pts }; }, onLand);
    if (bar) setTimeout(() => { bar.rotation.x = 0; }, 600);
    await wait(200);
  }
  function customerLeave() { if (customer && !custGone) { custWant = V(-13.5, FLOOR, -2.5); custGone = true; } }

  // ---------- camera ----------
  let portrait = false, mode: 'all' | 'portal' | 'test' | 'title' = 'all';
  const camDir = V();
  const cam = { cx: 0, cy: 0, s: 0.02 }, camWant = { cx: 0, cy: 0, s: 0.02 };
  function layoutCamera(snap = false) {
    const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight); portrait = h > w * 1.15;
    renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : touch ? 1.5 : 2));
    renderer.setSize(w, h, false);
    const az = THREE.MathUtils.degToRad(mode === 'title' ? 28 : portrait ? 90 : 18), el = THREE.MathUtils.degToRad(mode === 'title' ? 36 : portrait ? 58 : 44);
    camDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    let pts = L?.fit ?? [V(-11, 0, -4), V(8, 0, 4)];
    if (mode === 'test' && L) pts = [L.stand, ...Object.values(L.nodes), ...Object.values(L.keys), ...Object.entries(L.people).filter(([id]) => id !== L!.abroad).map(([,p]) => p)].flatMap(p => [p.clone().add(V(-1.1, 0, -1.1)), p.clone().add(V(1.1, 2.8, 1.1))]);
    if (mode === 'portal' && L?.isle && portalSock) { const p = L.nodes[portalSock]; pts = [p.clone().add(V(-2.6, 0, 0)), p.clone().add(V(-1, 0, 2.4)), p.clone().add(V(-1, 0, -2.4)), V(ISLE.x + ISLE.hx, 0, ISLE.z - ISLE.hz + 0.6), V(ISLE.x + ISLE.hx, 0, ISLE.z + ISLE.hz - 0.6), V((p.x + ISLE.x) / 2, 5.6, (p.z + ISLE.z) / 2)]; }
    camera.position.copy(camDir).multiplyScalar(80); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of pts) { const v = p.clone().applyMatrix4(camera.matrixWorldInverse); minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }
    const m = opts.margins?.(w, h, portrait, mode) ?? { t: 20, b: 20, l: 20, r: 20 };
    const s = Math.max((maxX - minX) / Math.max(80, w - m.l - m.r), (maxY - minY) / Math.max(80, h - m.t - m.b));
    camWant.cx = (minX + maxX) / 2 - ((m.l - m.r) / 2) * s; camWant.cy = (minY + maxY) / 2 - ((m.b - m.t) / 2) * s; camWant.s = s;
    if (snap) Object.assign(cam, camWant);
    applyCam();
  }
  function applyCam() {
    const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
    camera.position.copy(camDir).multiplyScalar(80); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const right = V(1, 0, 0).applyQuaternion(camera.quaternion), up = V(0, 1, 0).applyQuaternion(camera.quaternion);
    const drift = mode === 'title' && !low ? Math.sin(t * 0.18) * 0.7 : 0;
    const nudge = portalPhase === 'pop' && phaseT > 1.1 && phaseT < 1.5 && !low ? Math.sin((phaseT - 1.1) * 30) * 0.12 : 0;
    const tgt = V().addScaledVector(right, cam.cx + drift + nudge).addScaledVector(up, cam.cy);
    camera.position.copy(tgt).addScaledVector(camDir, 80); camera.lookAt(tgt);
    camera.left = (-w / 2) * cam.s; camera.right = (w / 2) * cam.s; camera.top = (h / 2) * cam.s; camera.bottom = (-h / 2) * cam.s;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const project = (p: V3) => { tmpV.copy(p).project(camera); return { x: (tmpV.x * 0.5 + 0.5) * innerWidth, y: (-tmpV.y * 0.5 + 0.5) * innerHeight, visible: tmpV.z < 1 }; };

  // ---------- loop ----------
  let t = 0, raf = 0, last = performance.now(), disposed = false;
  function step(dt: number) {
    t += dt;
    waterU.t.value = t;
    const k0 = Math.min(1, dt * 3.2);
    if (Math.abs(cam.s - camWant.s) > 1e-6 || Math.abs(cam.cx - camWant.cx) > 1e-4 || Math.abs(cam.cy - camWant.cy) > 1e-4) {
      cam.cx += (camWant.cx - cam.cx) * k0; cam.cy += (camWant.cy - cam.cy) * k0; cam.s += (camWant.s - cam.s) * k0; applyCam();
    }
    for (const b of belts) b.tex.offset.x -= dt * 2.2 / 0.6;
    if (mode === 'title' || (portalPhase === 'pop' && phaseT < 1.6)) applyCam();
    for (const [id, rec] of tiles) {
      const on = glow.has(id), nx = nextSock === id;
      const k = 0.5 + 0.5 * Math.sin(t * 5);
      (rec.tile.material as THREE.MeshBasicMaterial).opacity = nx ? 0.75 + 0.25 * k : on ? 0.7 : 0.4;
      (rec.fill.material as THREE.MeshBasicMaterial).opacity = nx ? 0.2 + 0.25 * k : on ? 0.22 : 0.07;
      (rec.tile.material as THREE.MeshBasicMaterial).color.set(nx ? '#ffe14d' : on ? '#2ee6c8' : '#ffffff');
      rec.tile.scale.setScalar(nx ? 1 + 0.05 * k : 1);
    }
    for (const rec of partMeshes.values()) {
      rec.o.position.lerp(rec.want, Math.min(1, dt * 8));
      const sp = rec.o.userData.spin as THREE.Object3D | undefined; if (sp) sp.rotation.y += dt * 1.5;
    }
    for (const o of springs) {
      const u = o.userData; const a = -260 * u.sx - 14 * u.sv; u.sv += a * dt; u.sx += u.sv * dt;
      const s = THREE.MathUtils.clamp(u.sx, -0.35, 0.35), b = u.base ?? 1; o.scale.set(b * (1 + s * 0.6), b * (1 - s), b * (1 + s * 0.6));
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
    // portal: while NEAR signs, coins keep diving into it
    phaseT += dt;
    if (portalPhase === 'swirl' && portalSock && L) {
      diveT -= dt;
      if (diveT <= 0) { diveT = 0.55; const p = L.nodes[portalSock]; const a = Math.random() * 6.28; void spawn(V(p.x + Math.cos(a) * 1.4, 2.6, p.z + Math.sin(a) * 1.4), [{ kind: 'arc', to: p.clone().setY(FLOOR + 0.25), h: 0.5, dur: 0.7 }], diveKind, 0); }
    }
    const gl = portalPhase === 'swirl' ? 1 : portalPhase === 'beam' ? 1.4 : 0;
    if (portalSwirl) { portalSwirl.uniforms.t.value = t * (portalPhase === 'swirl' && !low ? 2.8 : 1); portalSwirl.uniforms.glow.value += (gl - portalSwirl.uniforms.glow.value) * Math.min(1, dt * 4); }
    if (exitSwirl) { exitSwirl.uniforms.t.value = t; exitSwirl.uniforms.glow.value += ((portalPhase === 'beam' || portalPhase === 'pop' ? 1 : 0) - exitSwirl.uniforms.glow.value) * Math.min(1, dt * 3); }
    if (portalPhase === 'beam') { beamU.fade.value = Math.min((low ? 1 : 0.86 + 0.14 * Math.sin(phaseT * 9)), beamU.fade.value + dt * 3); beamU.head.value = Math.min(1.6, phaseT / 1.2); }
    else beamU.fade.value = Math.max(0, beamU.fade.value - dt * 2);
    if (gem.visible) {
      const k = Math.min(1, phaseT / 1.1); gem.position.lerpVectors(gemFrom, gemTo, easeInOut(k)); gem.position.y += Math.sin(Math.PI * k) * 2.2;
      gem.rotation.y += dt * 3;
    }
    for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.t += dt; const p = project(f.at); f.el.style.transform = `translate3d(${p.x}px, ${p.y - f.t * 40}px, 0)`; f.el.style.opacity = String(Math.max(0, 1 - Math.max(0, f.t - 1.4) / 0.6)); if (f.t > 2) { f.el.remove(); floaters.splice(i, 1); } }
  }
  function draw() {
    drawCoins();
    let n = 0; for (const p of parts) { tmpM.compose(p.p, tmpQ.identity(), tmpS.setScalar(Math.max(0.1, p.life))); pMesh.setMatrixAt(n, tmpM); pMesh.setColorAt(n, p.c); n++; }
    tmpS.set(1, 1, 1);
    pMesh.count = n; pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
    if(canvas.closest('.is-factory')) return;
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
  const onResize = () => layoutCamera(true);
  addEventListener('resize', onResize);
  // Explicit deterministic capture mode: the existing advance hook owns rendering.
  // Normal play always uses requestAnimationFrame.
  if (params.get('step') !== '1') raf = requestAnimationFrame(n => { last = n; frame(n); });
  (window as unknown as { __ww2: unknown }).__ww2 = { renderScale: (ratio: number) => { renderer.setPixelRatio(Math.max(0.25, Math.min(1, ratio))); draw(); }, state: () => ({ coins: coins.length, held: coins.filter(c => c.gate).length, portal: portalPhase, gem: gem.visible, customer: customer?.visible ?? false, mode }), advance: (s: number) => { for (let i = 0; i < Math.round(s * 30); i++) step(1 / 30); draw(); } };

  return {
    is2d: false,
    setJob, setBuild,
    setGlow(s, n) { glow = new Set(s); nextSock = n; },
    playSale, release, customerLeave,
    stopSim() { for(const c of coins) if(c.kind==='sim') {c.gone=true;c.done();} },
    setPortal(phase, kind) {
      if (phase === portalPhase) return;
      if(phase==='beam') sound.play('beam');
      portalPhase = phase; phaseT = 0; diveKind = kind;
      if (phase === 'beam') beamU.head.value = 0;
      if (phase === 'pop' && L && L.abroad) {
        const who = L.people[L.abroad]!;
        gemFrom = L.exit.clone().setY(FLOOR + 0.6); gemTo = who.clone().setY(1.35); gem.visible = true;
        burst(gemFrom, 24, '#9fb0ff');
        const ab = L.abroad;
        setTimeout(() => { const c = chars.get(ab); if (c) { kick(c.userData.body, 4); hops.set(ab, 0.35); } burst(gemTo, 18, '#ffe14d'); }, 1100);
      }
      if (phase === 'idle') gem.visible = false;
    },
    focus(m) { if (m === mode) return; mode = m; layoutCamera(false); },
    floater(anchor, html, cls = '') { if (!L) return; const p = anchorPoint(L, anchor); if (p) floaterAt(p.clone().setY(p.y + 0.5), html, cls); },
    hop(person) { const c = chars.get(person); if (c) { kick(c.userData.body, 4); hops.set(person, 0.35); } },
    relayout: () => layoutCamera(false),
    dispose() {
      disposed = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize);
      for (const f of floaters) f.el.remove();
      scene.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mm = m.material; if (mm) (Array.isArray(mm) ? mm : [mm]).forEach(x => x.dispose()); });
      disposables.forEach(d => d.dispose()); envTex.dispose(); pmrem.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
  void build;
}

// ------------------------------------------------------------------ 2D fallback (no WebGL): static diagram, same anchors
function create2D(canvas: HTMLCanvasElement, overlay: HTMLElement, opts: SceneOpts): JobScene {
  canvas.dataset.fallback = '2d';
  const c = canvas.getContext('2d');
  let L: Layout | null = null, job: Job | null = null, world: World = { people: [] };
  const map = { sx: 1, ox: 0, oy: 0 };
  const P = (p: V3) => ({ x: map.ox + (p.x + p.z * 0.35) * map.sx, y: map.oy + (p.z * 0.6 - (p.y ?? 0) * 0.8) * map.sx, visible: true });
  function fit() {
    const w = innerWidth, h = innerHeight; canvas.width = w; canvas.height = h;
    if (!L) return;
    const m = opts.margins?.(w, h, h > w * 1.15, 'all') ?? { t: 20, b: 20, l: 20, r: 20 };
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
    const poly = (pts: [number, number][]) => { c.beginPath(); pts.forEach(([x, z], i) => { const q = P(V(x, 0, z)); if (i) c.lineTo(q.x, q.y); else c.moveTo(q.x, q.y); }); c.stroke(); };
    poly(standPts(Lo));
    for (const e of Lo.edges) poly(edgePts(Lo.nodes[e.from], Lo.nodes[e.to]));
    const dot = (p: V3, r: number, col: string) => { const q = P(p); c.fillStyle = col; c.beginPath(); c.arc(q.x, q.y, r, 0, 7); c.fill(); };
    dot(Lo.stand, map.sx * 0.9, '#ffd23f');
    for (const [id, p] of Object.entries(Lo.people)) if (p && id !== 'customer') dot(p, map.sx * 0.45, PEOPLE[id as PersonId].shirt);
    if (Lo.isle) dot(Lo.exit, map.sx * 0.8, '#6f7ff0');
    c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '13px sans-serif'; c.textAlign = 'left'; c.fillText('2D view · all controls work', 12, canvas.height - 12);
  }
  let raf = 0, disposed = false;
  const loop = () => { if (disposed) return; if (L) { const Lo = L; placeAnchors(overlay, id => { const p = anchorPoint(Lo, id); return p ? P(p) : null; }); } raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  addEventListener('resize', fit);
  return {
    is2d: true,
    setJob(j, w) { job = j; world = w; L = layoutFor(j, { r: null }, w); fit(); },
    setBuild(b) { if (job) { L = layoutFor(job, b, world); draw(); } },
    setGlow() { /* DOM sockets carry the highlight */ },
    async playSale(plan, onLand) { await wait(700); for (const f of plan.flows) { if(plan.cancelled?.()) return; await wait(150); onLand?.(f); } },
    async release(_g, flows, _k, onLand) { await wait(400); for (const f of flows) onLand?.(f); },
    stopSim() { /* static fallback; cancellation is checked by playSale */ },
    customerLeave() { /* nothing animated */ },
    setPortal() { /* the HUD card shows the phase */ },
    focus() { /* static */ },
    floater(anchor, html, cls = '') {
      if (!L) return; const p = anchorPoint(L, anchor); if (!p) return;
      const q = P(p); const el = document.createElement('div'); el.className = 'j-floater ' + cls; el.innerHTML = html; el.style.transform = `translate3d(${q.x}px, ${q.y - 20}px, 0)`; overlay.appendChild(el); setTimeout(() => el.remove(), 1800);
    },
    hop() { /* static */ },
    relayout: fit,
    dispose() { disposed = true; cancelAnimationFrame(raf); removeEventListener('resize', fit); },
  };
}
