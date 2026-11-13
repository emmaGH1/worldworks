// WORLDWORKS 2.5D world (from the approved UI-2 concept, app/concepts/ui2).
// The world only animates what it is told: every coin comes from a Flow built from engine/API effects,
// and the Portal's real states are pushed in from PayoutView.status by the game (never from a timer).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { near, eth } from '../lib/units';

export type FlowKind = 'sim' | 'real' | 'mock';
/** One order as coins. Counts are visual (1 coin ≈ 0.01 NEAR); the yocto/wei amounts are the true values shown in tags. */
export interface Flow {
  key: string; kind: FlowKind;
  vault: number; portal: number; payout: number; held: number;
  vaultYocto: bigint; feeYocto: bigint; payoutYocto: bigint; wei: bigint; priceYocto: bigint;
  payoutTo?: string;
}
export type PortalPhase = 'swirl' | 'beam' | 'pop' | 'failed';
export type Parts = { splitter: boolean; vault: boolean; portal: boolean; payout: boolean; splitLabel?: string; vaultShare?: number; priceLabel?: string; vaultName?: string };
export type Anchor = 'slot' | 'stand' | 'vault' | 'portal' | 'exit' | 'beamMid' | 'mailbox' | 'customer' | 'supplier' | 'splitter';
export type Focus = 'stand' | 'portal' | 'slot' | 'eth' | 'vault' | null;
export interface WorldOptions {
  variant: 'game' | 'app';
  nextSimOrder?: () => Flow | null;
  onSale?: (f: Flow) => void;
  onPortalDone?: (key: string) => void;
  onFx?: (level: number) => void;
  margins?: (w: number, h: number, portrait: boolean) => { t: number; b: number; l: number; r: number };
}
export interface World {
  setParts(p: Parts): void;
  setArmed(on: boolean): void;
  setHover(on: boolean): void;
  hitSlot(x: number, y: number): boolean;
  placeSplitter(): void;
  setSimCustomers(on: boolean): void;
  callRealCustomer(label: string): void;
  payReal(flow: Flow): void;
  realCustomerLeave(): void;
  setPortal(key: string, phase: PortalPhase): void;
  releaseHeld(): void;
  screen(a: Anchor): { x: number; y: number; visible: boolean };
  onFrame(cb: () => void): () => void;
  setMuted(m: boolean): void;
  focus(f: Focus): void;
  pick(x: number, y: number): Anchor | null;
  setCaptions(on: boolean): void;
  relayout(): void;
  fxLevel(): number;
  dispose(): void;
}

type V3 = THREE.Vector3;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const COIN_YOCTO = 10n ** 22n;
const COIN_COLOR: Record<FlowKind, string> = { sim: '#ffc53a', real: '#2ee6a8', mock: '#ff8a74' };
const KIND_LABEL: Record<FlowKind, string> = { sim: 'SIMULATED', real: 'REAL · testnet', mock: 'MOCK' };

export function createWorld(canvas: HTMLCanvasElement, tagLayer: HTMLElement, opts: WorldOptions): World {
  const params = new URLSearchParams(location.search);
  const touch = matchMedia('(pointer: coarse)').matches;
  const fxHigh = params.get('fx') === 'high';
  let fx = params.get('lowfx') === '1' ? 2 : 0; // 0 full, 1 reduced, 2 low
  let seed = 7;
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // ---------- renderer / scene ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: fx < 2, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#3f979d');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.35;
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
  scene.add(new THREE.HemisphereLight('#fff7e8', '#4f9f98', 1.15));
  const sun = new THREE.DirectionalLight('#fff0d6', 3.3);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 120 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  sun.target.position.set(3, 0, -1);
  sun.position.set(3 - 14, 26, -1 - 5);

  function applyFx() {
    const cap = fx === 0 ? (touch ? 1.5 : 2) : fx === 1 ? 1.25 : 1;
    renderer.setPixelRatio(Math.min(devicePixelRatio, cap));
    renderer.setSize(innerWidth, innerHeight, false);
    const shadows = fx < 2;
    const size = fx === 0 && !touch ? 2048 : 1024;
    if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    if (renderer.shadowMap.enabled !== shadows) {
      renderer.shadowMap.enabled = shadows; sun.castShadow = shadows;
      scene.traverse(o => { const m = (o as THREE.Mesh).material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => (x.needsUpdate = true)); });
    }
  }
  renderer.shadowMap.enabled = fx < 2; sun.castShadow = fx < 2;

  // ---------- palette / helpers ----------
  const C = {
    grass: '#8cc862', grassDark: '#7fbf55', cliff: '#b8977a', cliffDark: '#987a60', sand: '#f6e3b4',
    floor: '#f4ecdc', belt: '#2d3040', rail: '#ff8a3d',
    slot: '#ffd23f', awningA: '#ff6f91', awningB: '#fff6ec', split: '#2ec4b6', vault: '#6f61b8', vaultDark: '#4e4390',
    portal: '#8b5cf6', portalDark: '#3a2f6b', eth: '#6f7ff0', ethDark: '#2f3a7a', ethCliff: '#7c86c4', mail: '#5fbf6f',
  };
  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const k = color + JSON.stringify(o);
    if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...o }));
    return matCache.get(k)!;
  };
  function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = scene) {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  function rbox(w: number, h: number, d: number, color: string | THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = scene, r = 0.12) {
    const m = typeof color === 'string' ? mat(color) : color;
    return mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)), m, x, y + h / 2, z, parent);
  }
  function group(x = 0, y = 0, z = 0, parent: THREE.Object3D = scene) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
  const redraws: (() => void)[] = [];
  function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d')!; draw(ctx);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    redraws.push(() => { ctx.clearRect(0, 0, w, h); draw(ctx); t.needsUpdate = true; });
    return t;
  }
  const springs: THREE.Object3D[] = [];
  function springy(o: THREE.Object3D) { o.userData.sx = 0; o.userData.sv = 0; o.userData.base = 1; springs.push(o); return o; }
  function kick(o: THREE.Object3D, v = 4) { o.userData.sv += v; }
  function stepSprings(dt: number) {
    for (const o of springs) {
      const u = o.userData; const a = -260 * u.sx - 14 * u.sv; u.sv += a * dt; u.sx += u.sv * dt;
      const s = THREE.MathUtils.clamp(u.sx, -0.35, 0.35), b = u.base as number;
      o.scale.set(b * (1 + s * 0.6), b * (1 - s), b * (1 + s * 0.6));
    }
  }

  const FLOOR = 0.12, BELT_TOP = FLOOR + 0.1, WATER_Y = -0.9;

  // ---------- water + islands ----------
  type Isle = { cx: number; cz: number; hx: number; hz: number };
  const NEAR_ISLE: Isle = { cx: -2, cz: 0, hx: 10.6, hz: 7.2 };
  const ETH_ISLE: Isle = { cx: 16, cz: -7.2, hx: 3.7, hz: 3.3 };
  const waterU = { t: { value: 0 }, isl: { value: [NEAR_ISLE, ETH_ISLE].map(i => new THREE.Vector4(i.cx, i.cz, i.hx + 0.75, i.hz + 0.75)) } };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShaderMaterial({
    uniforms: waterU,
    vertexShader: `varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float t; uniform vec4 isl[2]; varying vec2 vW;
      float sdR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.)) + min(max(q.x,q.y),0.) - r; }
      void main(){
        float d = 1e9;
        for(int i=0;i<2;i++){ d = min(d, sdR(vW - isl[i].xy, isl[i].zw, 1.6)); }
        vec3 deep = vec3(0.05,0.33,0.37), shallow = vec3(0.30,0.74,0.70);
        vec3 col = mix(shallow, deep, smoothstep(0.0, 5.0, d));
        float n = sin(vW.x*0.9 + t*0.6)*sin(vW.y*1.1 - t*0.5) + sin((vW.x+vW.y)*0.35 + t*0.3);
        col += 0.025*n;
        float band = smoothstep(0.86, 0.95, sin(d*3.6 - t*1.8)*0.5+0.5) * smoothstep(2.2, 0.3, d);
        float foam = smoothstep(0.22, 0.0, d);
        col = mix(col, vec3(1.0), max(foam*0.85, band*0.35));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  water.rotation.x = -Math.PI / 2; water.position.y = WATER_Y; scene.add(water);
  function island(i: Isle, top: string, cliff: string, cliffLow: string) {
    const w = i.hx * 2, d = i.hz * 2;
    rbox(w + 1.5, 0.32, d + 1.5, C.sand, i.cx, WATER_Y - 0.22, i.cz, scene, 0.7);
    rbox(w, 0.9, d, cliffLow, i.cx, WATER_Y - 0.1, i.cz, scene, 0.6);
    rbox(w - 0.1, 0.5, d - 0.1, cliff, i.cx, -0.62 + 0.05, i.cz, scene, 0.5);
    rbox(w, 0.4, d, top, i.cx, -0.38, i.cz, scene, 0.4);
  }
  island(NEAR_ISLE, C.grass, C.cliff, C.cliffDark);
  for (let k = 0; k < 70; k++) { const x = NEAR_ISLE.cx + (rnd() * 2 - 1) * (NEAR_ISLE.hx - 0.4), z = NEAR_ISLE.cz + (rnd() * 2 - 1) * (NEAR_ISLE.hz - 0.4); if (Math.abs(x + 0.5) < 8.4 && Math.abs(z) < 5.0) continue; mesh(new THREE.ConeGeometry(0.09, 0.26, 4), mat(C.grassDark, { flatShading: true }), x, 0.1, z).castShadow = false; }
  island(ETH_ISLE, '#c3cbf2', C.ethCliff, '#5f69a8');
  const gridTex = canvasTex(256, 256, c => {
    c.fillStyle = C.floor; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = 'rgba(160,130,90,0.22)'; c.lineWidth = 4; c.strokeRect(0, 0, 256, 256);
    c.fillStyle = 'rgba(160,130,90,0.18)'; for (const [x, y] of [[0, 0], [256, 0], [0, 256], [256, 256]]) { c.beginPath(); c.arc(x, y, 14, 0, 7); c.fill(); }
  });
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
  {
    const fw = 15.8, fd = 9.4, fx0 = -0.5;
    const t = gridTex.clone(); t.repeat.set(fw, fd); t.needsUpdate = true;
    rbox(fw, FLOOR + 0.02, fd, mat('#ffffff', { map: t }), fx0, -0.02, 0, scene, 0.18).castShadow = false;
    rbox(fw + 0.3, 0.1, fd + 0.3, '#e1d3b8', fx0, -0.04, 0, scene, 0.2).castShadow = false;
  }
  rbox(5.6, FLOOR + 0.02, 5.0, '#eef0fc', 15.7, -0.02, -6.9, scene, 0.9).castShadow = false;

  // ---------- paths & belts ----------
  class Path {
    pts: V3[] = []; cum: number[] = []; length = 0;
    constructor(raw: [number, number][], y: number, r = 0.42) {
      const P = raw.map(([x, z]) => V(x, y, z));
      this.pts.push(P[0]);
      for (let i = 1; i < P.length - 1; i++) {
        const a = P[i - 1], b = P[i], c = P[i + 1];
        const din = b.clone().sub(a).normalize(), dout = c.clone().sub(b).normalize();
        const p0 = b.clone().addScaledVector(din, -r), p2 = b.clone().addScaledVector(dout, r);
        for (let k = 0; k <= 8; k++) { const t = k / 8, u = 1 - t; this.pts.push(V(u * u * p0.x + 2 * u * t * b.x + t * t * p2.x, y, u * u * p0.z + 2 * u * t * b.z + t * t * p2.z)); }
      }
      this.pts.push(P[P.length - 1]);
      this.cum = [0];
      for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + this.pts[i].distanceTo(this.pts[i - 1]));
      this.length = this.cum[this.cum.length - 1];
    }
    at(d: number, out: V3) {
      d = Math.max(0, Math.min(this.length, d));
      let i = 1; while (i < this.cum.length - 1 && this.cum[i] < d) i++;
      const t = (d - this.cum[i - 1]) / Math.max(1e-6, this.cum[i] - this.cum[i - 1]);
      return out.lerpVectors(this.pts[i - 1], this.pts[i], t);
    }
  }
  const chevronImg = canvasTex(128, 128, c => {
    c.clearRect(0, 0, 128, 128); c.strokeStyle = 'rgba(150,160,190,0.55)'; c.lineWidth = 14; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(42, 34); c.lineTo(78, 64); c.lineTo(42, 94); c.stroke();
  });
  const BELT_SPEED = 2.2;
  type Belt = { g: THREE.Group; tex: THREE.Texture[]; mats: THREE.MeshBasicMaterial[]; powered: boolean };
  function belt(raw: [number, number][]): Belt {
    const W = 0.72; const root = group(); const b: Belt = { g: root, tex: [], mats: [], powered: true };
    for (let i = 0; i < raw.length - 1; i++) {
      const a = V(raw[i][0], 0, raw[i][1]), e = V(raw[i + 1][0], 0, raw[i + 1][1]);
      const len = a.distanceTo(e), mid = a.clone().add(e).multiplyScalar(0.5), ang = Math.atan2(-(e.z - a.z), e.x - a.x);
      const g = group(mid.x, FLOOR, mid.z, root); g.rotation.y = ang;
      rbox(len + W, 0.1, W, C.belt, 0, 0, 0, g, 0.05);
      for (const s of [-1, 1]) rbox(len, 0.17, 0.08, C.rail, 0, 0, s * (W / 2 + 0.02), g, 0.035);
      const tex = chevronImg.clone(); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(len / 0.6, 1); tex.needsUpdate = true; b.tex.push(tex);
      const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }); b.mats.push(m);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(len, W * 0.8), m); pl.rotation.x = -Math.PI / 2; pl.position.y = 0.102; g.add(pl);
    }
    for (let i = 1; i < raw.length - 1; i++) {
      const j = group(raw[i][0], FLOOR, raw[i][1], root);
      mesh(new THREE.CylinderGeometry(W / 2 + 0.06, W / 2 + 0.06, 0.13, 24), mat(C.rail), 0, 0.065, 0, j);
      mesh(new THREE.CylinderGeometry(W / 2 - 0.04, W / 2 - 0.04, 0.14, 24), mat(C.belt), 0, 0.075, 0, j);
    }
    return b;
  }
  const P_SLOT_OUT: [number, number] = [-6.15, 0];
  const path0 = new Path([P_SLOT_OUT, [0, 0]], BELT_TOP + 0.03);
  const paths = {
    A: new Path([[0, 0.55], [2.1, 0.55], [2.1, 3.0], [3.35, 3.0]], BELT_TOP + 0.03),
    B: new Path([[0, -0.55], [2.9, -0.55], [2.9, -3.2], [4.55, -3.2]], BELT_TOP + 0.03),
    C: new Path([[0.3, 0], [3.7, 0]], BELT_TOP + 0.03),
  };
  const belt0 = belt([P_SLOT_OUT, [-0.7, 0]]);
  const belts = { A: belt([[0.7, 0.55], [2.1, 0.55], [2.1, 3.0], [3.3, 3.0]]), B: belt([[0.7, -0.55], [2.9, -0.55], [2.9, -3.2], [4.4, -3.2]]), C: belt([[0.8, 0], [3.7, 0]]) };
  const allBelts = [belt0, belts.A, belts.B, belts.C];

  // ---------- machines ----------
  const STAND = V(-7, FLOOR, 0);
  const stand = springy(group(STAND.x, STAND.y, STAND.z));
  {
    rbox(1.5, 0.95, 2.0, C.slot, 0, 0, 0, stand, 0.16);
    rbox(1.56, 0.12, 2.06, '#f2b81c', 0, 0.95, 0, stand, 0.05);
    for (let k = 0; k < 4; k++) rbox(0.05, 0.6, 0.05, '#ffffff', -0.55 + (k % 2) * 1.1, 1.05, (k < 2 ? -1 : 1) * 0.88, stand, 0.02);
    const aw = group(0, 1.62, 0, stand); aw.rotation.z = 0.22;
    for (let k = 0; k < 6; k++) rbox(1.7, 0.09, 0.38, k % 2 ? C.awningB : C.awningA, 0, 0, -0.95 + k * 0.38, aw, 0.04);
    rbox(0.1, 0.34, 0.8, '#3a2c10', -0.76, 0.38, 0, stand, 0.04);
    rbox(0.06, 0.07, 0.56, '#111', -0.81, 0.52, 0, stand, 0.02);
    mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.42, 16), mat('#fff3a6', { transparent: true, opacity: 0.85, roughness: 0.2 }), 0.2, 1.28, 0.45, stand);
    for (const [x, z] of [[0.15, -0.3], [0.32, -0.45], [0.05, -0.55]]) mesh(new THREE.SphereGeometry(0.11, 12, 10), mat('#ffe14d'), x, 1.17, z, stand).scale.set(1, 0.85, 1.25);
    const signTex = canvasTex(512, 128, c => {
      c.fillStyle = '#fff6ec'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#e8456f'; c.font = '700 74px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(opts.variant === 'app' ? 'BUY HERE' : 'LEMONADE', 256, 70);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.9 }));
    const sg = group(0, 2.1, 0.15, stand); sg.rotation.y = 0.42;
    rbox(1.86, 0.52, 0.08, '#e8456f', 0, -0.26, -0.05, sg, 0.03);
    sg.add(sign); sign.castShadow = true;
  }
  // slot tile where the Splitter goes (highlighted drop target)
  const tileTex = canvasTex(256, 256, c => {
    c.clearRect(0, 0, 256, 256);
    c.strokeStyle = '#ffffff'; c.lineWidth = 12; c.setLineDash([26, 18]); c.lineCap = 'round';
    c.beginPath(); c.roundRect(14, 14, 228, 228, 40); c.stroke();
    c.setLineDash([]); c.lineWidth = 18; c.beginPath(); c.moveTo(128, 88); c.lineTo(128, 168); c.moveTo(88, 128); c.lineTo(168, 128); c.stroke();
  });
  const tileMat = new THREE.MeshBasicMaterial({ map: tileTex, color: '#2ec4b6', transparent: true, depthWrite: false, opacity: 0.8 });
  const tileFill = new THREE.MeshBasicMaterial({ color: '#2ec4b6', transparent: true, depthWrite: false, opacity: 0.18 });
  const tile = group(0, FLOOR + 0.03, 0);
  { const a = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.3), tileFill); a.rotation.x = -Math.PI / 2; tile.add(a); const b = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.3), tileMat); b.rotation.x = -Math.PI / 2; b.position.y = 0.005; tile.add(b); }
  tile.visible = false;

  const SPLIT = V(0, FLOOR, 0);
  const splitter = springy(group(SPLIT.x, SPLIT.y, SPLIT.z));
  const needle = new THREE.Group();
  let splitShare = 0.7, splitLabel = '70';
  const pie = canvasTex(256, 256, c => {
    c.fillStyle = '#e9fffb'; c.beginPath(); c.arc(128, 128, 126, 0, 7); c.fill();
    c.fillStyle = '#ffc53a'; c.beginPath(); c.moveTo(128, 128); c.arc(128, 128, 112, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * splitShare); c.fill();
    c.fillStyle = '#8b5cf6'; c.beginPath(); c.moveTo(128, 128); c.arc(128, 128, 112, -Math.PI / 2 + Math.PI * 2 * splitShare, Math.PI * 1.5); c.fill();
    c.fillStyle = '#e9fffb'; c.beginPath(); c.arc(128, 128, 54, 0, 7); c.fill();
    c.fillStyle = '#1d2433'; c.font = '700 44px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(splitLabel, 128, 132);
  });
  {
    rbox(1.5, 0.78, 2.1, C.split, 0, 0, 0, splitter, 0.2);
    rbox(1.56, 0.1, 2.16, '#23a99c', 0, 0, 0, splitter, 0.05);
    for (const z of [0.55, -0.55]) rbox(0.12, 0.3, 0.6, '#16443f', 0.72, 0.12, z, splitter, 0.04);
    rbox(0.12, 0.3, 0.6, '#16443f', -0.72, 0.12, 0, splitter, 0.04);
    const dial = mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.12, 40), [mat('#e9fffb'), new THREE.MeshStandardMaterial({ map: pie, roughness: 0.6 }), mat('#e9fffb')] as unknown as THREE.Material, 0, 0.84, 0, splitter);
    dial.rotation.y = Math.PI / 2;
    needle.position.set(0, 0.92, 0); splitter.add(needle);
    rbox(0.07, 0.07, 0.5, '#1d2433', 0, 0, 0.22, needle, 0.03);
    mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 16), mat('#1d2433'), 0, 0.03, 0, needle);
  }
  let needleTarget = 0;

  const VAULT = V(4.35, FLOOR, 3.0);
  const vault = springy(group(VAULT.x, VAULT.y, VAULT.z));
  const VB = 0.34;
  {
    rbox(2.2, VB, 2.2, C.vault, 0, 0, 0, vault, 0.14);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rbox(0.24, 1.55, 0.24, C.vaultDark, x * 0.98, VB - 0.02, z * 0.98, vault, 0.08);
    for (const s of [-1, 1]) { rbox(2.2, 0.14, 0.2, C.vaultDark, 0, VB + 1.45, s * 0.98, vault, 0.06); rbox(0.2, 0.14, 2.2, C.vaultDark, s * 0.98, VB + 1.45, 0, vault, 0.06); }
    const glass = new THREE.MeshStandardMaterial({ color: '#dff4ff', transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.1, depthWrite: false });
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.42), glass); a.position.set(0, VB + 0.72, s * 0.99); vault.add(a);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.42), glass); b.position.set(s * 0.99, VB + 0.72, 0); b.rotation.y = Math.PI / 2; vault.add(b);
    }
    mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 20), mat('#d9d3ff', { metalness: 0.4, roughness: 0.3 }), 0.5, VB / 2, 1.11, vault).castShadow = false;
  }
  // Payout mailbox (used by the standalone app for machines with a Payout)
  const MAILBOX = V(4.45, FLOOR, 0);
  const mailbox = springy(group(MAILBOX.x, MAILBOX.y, MAILBOX.z));
  {
    rbox(0.16, 0.7, 0.16, '#3d4256', 0, 0, 0, mailbox, 0.04);
    rbox(0.9, 0.62, 0.7, C.mail, 0, 0.66, 0, mailbox, 0.2);
    rbox(0.08, 0.06, 0.4, '#1d2433', -0.46, 1.0, 0, mailbox, 0.02);
    rbox(0.05, 0.42, 0.05, '#e8456f', 0.3, 1.2, 0.36, mailbox, 0.02);
    rbox(0.22, 0.14, 0.04, '#e8456f', 0.4, 1.5, 0.36, mailbox, 0.02);
  }
  const swirlMats: THREE.ShaderMaterial[] = [];
  function portal(x: number, z: number, ring: string, base: string, c1: string, c2: string) {
    const g = springy(group(x, FLOOR, z));
    mesh(new THREE.CylinderGeometry(1.12, 1.22, 0.32, 40), mat(base), 0, 0.16, 0, g);
    const torus = mesh(new THREE.TorusGeometry(0.9, 0.16, 14, 48), mat(ring, { emissive: ring, emissiveIntensity: 0.35, roughness: 0.4 }), 0, 0.34, 0, g);
    torus.rotation.x = Math.PI / 2;
    const sm = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, c1: { value: new THREE.Color(c1) }, c2: { value: new THREE.Color(c2) }, glow: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float t, glow; uniform vec3 c1, c2; varying vec2 vUv;
        void main(){ vec2 p = vUv*2.-1.; float r = length(p); float a = atan(p.y,p.x);
          float s = sin(a*3. + r*9. - t*(4.+glow*10.)); vec3 col = mix(c1, c2, smoothstep(-0.2,0.8,s)*(1.-r*0.6));
          col = mix(col, vec3(1.), smoothstep(0.38, 0.0, r)*(0.55+glow*0.45));
          gl_FragColor = vec4(col*(1.+glow*0.6), 1.);
          #include <colorspace_fragment>
        }`,
    });
    swirlMats.push(sm);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.82, 48), sm); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.33; g.add(disc);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      rbox(0.2, 0.62, 0.2, base, Math.cos(a) * 1.2, 0.2, Math.sin(a) * 1.2, g, 0.06);
      mesh(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshBasicMaterial({ color: c2 }), Math.cos(a) * 1.2, 0.9, Math.sin(a) * 1.2, g).castShadow = false;
    }
    return { g, sm, top: V(x, FLOOR + 0.35, z), c1: new THREE.Color(c1), c2: new THREE.Color(c2) };
  }
  const PORTAL = portal(5.65, -3.2, C.portal, C.portalDark, '#5b3bd6', '#4fd1ff');
  const EXIT = portal(13.9, -6.4, C.eth, C.ethDark, '#3949c9', '#9fb0ff');

  // ---------- decor ----------
  function tree(x: number, z: number, kind: number, s = 1) {
    const g = group(x, 0, z); g.scale.setScalar(s);
    rbox(0.14, 0.4, 0.14, '#8a5a3c', 0, 0, 0, g, 0.04);
    if (kind === 0) { const c = mesh(new THREE.ConeGeometry(0.42, 1.0, 7), mat('#3fae6a', { flatShading: true }), 0, 0.85, 0, g); c.rotation.y = rnd(); }
    else {
      mesh(new THREE.IcosahedronGeometry(0.48, 1), mat(kind === 2 ? '#5bbf5f' : '#6fcf6a', { flatShading: true }), 0, 0.72, 0, g);
      if (kind === 2) for (let k = 0; k < 5; k++) { const a = k * 1.3; mesh(new THREE.SphereGeometry(0.08, 8, 6), mat('#ffe14d'), Math.cos(a) * 0.38, 0.6 + (k % 3) * 0.13, Math.sin(a) * 0.38, g); }
    }
  }
  for (const [x, z, k, s] of [[-12, 6, 0, 1.1], [-11.2, 6.4, 1, 1], [-12.2, 4.6, 2, 1], [-4, 6.4, 2, 0.9], [-2.6, 6.5, 1, 0.8], [7.6, 6.2, 0, 1.1], [8, 4.8, 1, 0.9], [6.4, 6.5, 2, 0.85], [-6, -6.6, 0, 1], [-4.5, -6.5, 1, 0.9], [1, -6.5, 0, 1.2], [2.4, -6.4, 2, 0.9], [8, -1, 0, 1], [8.1, 0.8, 1, 0.8], [-12.1, 1.8, 2, 0.9]] as const) tree(x, z, k, s);
  function house(x: number, z: number, body: string, roof: string, h = 0.9, rot = 0) {
    const g = group(x, 0, z); g.rotation.y = rot;
    rbox(1.0, h, 1.0, body, 0, 0, 0, g, 0.08);
    const r = mesh(new THREE.ConeGeometry(0.82, 0.62, 4), mat(roof, { flatShading: true }), 0, h + 0.3, 0, g); r.rotation.y = Math.PI / 4;
    rbox(0.26, 0.42, 0.06, '#5a3a2a', 0, 0, 0.5, g, 0.03);
    for (const s of [-1, 1]) rbox(0.18, 0.18, 0.04, '#bfe6ff', s * 0.3, h * 0.55, 0.51, g, 0.02);
  }
  house(-10.4, -5.6, '#ffffff', '#ef6f4f', 1.0, 0.1);
  house(-8.9, -6.0, '#ffd9a8', '#e85d5d', 0.8, -0.15);
  house(-11.6, -4.0, '#c9f0dd', '#ef8a4f', 1.25, 0.4);
  const HUT = V(17.5, 0, -8.7);
  house(HUT.x, HUT.z, '#ffffff', '#4f5fe0', 1.1, -0.3);
  for (const [x, z, s] of [[18.8, -4.6, 1], [12.9, -9.6, 0.8], [19.2, -9.9, 1.2], [12.6, -4.2, 0.7]] as const) {
    const c = mesh(new THREE.OctahedronGeometry(0.4 * s, 0), mat('#9aa8ff', { flatShading: true, roughness: 0.25, metalness: 0.2, emissive: '#3b4bd1', emissiveIntensity: 0.15 }), x, 0.38 * s, z);
    c.scale.y = 1.6; c.rotation.y = x;
  }
  const PILE = V(16.3, FLOOR, -4.9);
  rbox(1.6, 0.16, 1.3, '#b98a5a', PILE.x, FLOOR, PILE.z, scene, 0.04);
  for (let k = 0; k < 4; k++) rbox(1.6, 0.04, 0.22, '#d9a873', PILE.x, FLOOR + 0.16, PILE.z - 0.48 + k * 0.32, scene, 0.02);

  // ---------- characters ----------
  const SKIN = ['#f2c7a5', '#c98f68', '#8d5a3b', '#f5d7bd', '#a8724f'];
  const SHIRT = ['#ff6f91', '#4fb3ff', '#ffb020', '#7bd389', '#a78bfa', '#ff8a3d', '#2ec4b6'];
  function character(shirt: string, skin: string) {
    const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
    mesh(new THREE.CapsuleGeometry(0.19, 0.2, 4, 10), mat(shirt), 0, 0.29, 0, body);
    mesh(new THREE.SphereGeometry(0.17, 16, 12), mat(skin), 0, 0.68, 0, body);
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.028, 6, 6), mat('#1d2433'), s * 0.065, 0.7, 0.155, body).castShadow = false;
    const cup = new THREE.Group(); cup.position.set(0.2, 0.4, 0.12); body.add(cup); cup.visible = false;
    mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.17, 10), mat('#fff3a6'), 0, 0, 0, cup);
    mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 5), mat('#ff6f91'), 0.02, 0.12, 0, cup);
    scene.add(root);
    return { root, body, cup };
  }
  const supplier = character('#4f5fe0', SKIN[1]);
  supplier.root.position.set(16.9, FLOOR, -7.3); supplier.root.rotation.y = -0.6;
  let supplierHop = 0;

  // ---------- coins / stack / gems / particles ----------
  const coinGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.06, 22);
  const coinMat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.55, roughness: 0.3, emissive: '#3a2a00', emissiveIntensity: 0.25 });
  const MAX_COINS = 260;
  const coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, MAX_COINS); coinMesh.castShadow = true; coinMesh.frustumCulled = false; scene.add(coinMesh);
  const colorOf: Record<FlowKind, THREE.Color> = { sim: new THREE.Color(COIN_COLOR.sim), real: new THREE.Color(COIN_COLOR.real), mock: new THREE.Color(COIN_COLOR.mock) };
  for (let i = 0; i < MAX_COINS; i++) coinMesh.setColorAt(i, colorOf.sim);
  type Dest = 'A' | 'B' | 'C' | 'H';
  type OrderRec = { flow: Flow; vaultIn: number; portalIn: number; payoutIn: number };
  type Coin = { st: 'belt0' | 'hub' | 'path' | 'hop' | 'fall' | 'toss' | 'mail' | 'orbit' | 'suck' | 'held'; d: number; t: number; dur: number; from: V3; to: V3; pos: V3; spin: number; flip: number; s: number; rec: OrderRec | null; dest: Dest; slot: number; a: number; tossFlow?: Flow };
  const coins: Coin[] = [];
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = V(), tmpV = V();
  const STACK_COLS = 9, STACK_LEVELS = 18, STACK_MAX = STACK_COLS * STACK_LEVELS;
  const stackMesh = new THREE.InstancedMesh(coinGeo, coinMat, STACK_MAX); stackMesh.castShadow = true; stackMesh.frustumCulled = false; stackMesh.count = 0; scene.add(stackMesh);
  for (let i = 0; i < STACK_MAX; i++) stackMesh.setColorAt(i, colorOf.sim);
  let stackCount = 0, stackReserved = 0, gulpT = -1;
  function stackPos(k: number, out: V3) {
    const col = k % STACK_COLS, lvl = Math.floor(k / STACK_COLS);
    const cx = (col % 3) - 1, cz = Math.floor(col / 3) - 1, j = Math.sin(k * 12.9898) * 0.03;
    return out.set(VAULT.x + cx * 0.52 + j, VAULT.y + VB + 0.03 + lvl * 0.062, VAULT.z + cz * 0.52 - j);
  }
  const gemGeo = new THREE.OctahedronGeometry(0.2, 0);
  const gemMat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.35, roughness: 0.18, flatShading: true, emissive: '#2e3bc4', emissiveIntensity: 0.35 });
  const GEM_COLOR: Record<FlowKind, THREE.Color> = { sim: new THREE.Color('#8d9bff'), real: new THREE.Color('#5ff5c4'), mock: new THREE.Color('#ffa494') };
  const GEM_MAX = 24;
  const gemPile = new THREE.InstancedMesh(gemGeo, gemMat, GEM_MAX); gemPile.castShadow = true; gemPile.frustumCulled = false; gemPile.count = 0; scene.add(gemPile);
  for (let i = 0; i < GEM_MAX; i++) gemPile.setColorAt(i, GEM_COLOR.sim);
  let gemCount = 0;
  type Gem = { t: number; m: THREE.Mesh; slot: number; kind: FlowKind };
  const flyingGems: Gem[] = [];
  function gemSlot(k: number, out: V3) { const c = k % 12, l = Math.floor(k / 12); return out.set(PILE.x - 0.55 + (c % 4) * 0.37 + l * 0.18, PILE.y + 0.32 + l * 0.3, PILE.z - 0.37 + Math.floor(c / 4) * 0.37); }
  const MAX_P = 420;
  const pMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: '#ffffff' }), MAX_P);
  pMesh.frustumCulled = false; pMesh.count = 0; scene.add(pMesh);
  for (let i = 0; i < MAX_P; i++) pMesh.setColorAt(i, new THREE.Color('#fff'));
  type Particle = { p: V3; v: V3; life: number; max: number; c: THREE.Color; s: number; g: number };
  const parts: Particle[] = [];
  function burst(at: V3, n: number, color: string, speed = 2.2, up = 2.5, g = 9, size = 1) {
    for (let i = 0; i < n && parts.length < MAX_P; i++) {
      const a = rnd() * Math.PI * 2, sp = speed * (0.4 + rnd() * 0.8);
      parts.push({ p: at.clone(), v: V(Math.cos(a) * sp, up * (0.5 + rnd()), Math.sin(a) * sp), life: 0, max: 0.5 + rnd() * 0.5, c: new THREE.Color(color), s: size * (0.6 + rnd() * 0.8), g });
    }
  }

  // ---------- portal beam ----------
  const beamCurve = new THREE.QuadraticBezierCurve3(PORTAL.top.clone().setY(FLOOR + 0.5), V(10.6, 6.0, -2.6), EXIT.top.clone().setY(FLOOR + 0.5));
  const beamU = { head: { value: -1 }, fade: { value: 0 }, col: { value: new THREE.Color('#6a4cf0') } };
  const beam = new THREE.Mesh(new THREE.TubeGeometry(beamCurve, 80, 0.11, 10), new THREE.ShaderMaterial({
    uniforms: beamU, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float head, fade; uniform vec3 col; varying vec2 vUv;
      void main(){ float x = vUv.x; float trail = smoothstep(head-0.6, head, x) * step(x, head);
        float a = max(trail*0.95, 0.35*step(x, head)) * fade; gl_FragColor = vec4(mix(col, vec3(1.), trail*trail*0.8), a); }`,
  }));
  scene.add(beam);
  const glowTex = canvasTex(64, 64, c => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(190,180,255,0.8)'); g.addColorStop(1, 'rgba(120,110,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
  const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  orb.scale.setScalar(1.4); orb.visible = false; scene.add(orb);
  const orbCore = mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ color: '#8d9bff', metalness: 0.35, roughness: 0.18, flatShading: true, emissive: '#2e3bc4', emissiveIntensity: 0.5 })); orbCore.visible = false;
  type Jump = { t: number; flow: Flow; popped: boolean };
  const rings: { m: THREE.Mesh; t: number; max: number }[] = [];
  function shock(at: V3, color: string, max = 3.2) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 48), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.copy(at); scene.add(m); rings.push({ m, t: 0, max });
  }
  let jump: Jump | null = null;
  // Real/mock Portal payout: shown state follows `want`, which only the game sets (from PayoutView.status).
  type RealJump = { key: string; flow: Flow; need: number; inn: number; want: PortalPhase; shown: 'none' | 'swirl' | 'beam' | 'travel' | 'popped' | 'failed'; t: number; u: number };
  const realJumps = new Map<string, RealJump>();
  const pendingPhase = new Map<string, PortalPhase>();
  let beamOwner: RealJump | null = null;
  const poppedKeys: string[] = [];

  // ---------- tags & floaters ----------
  type Tag = { el: HTMLElement; at: V3; dy: number; follow?: () => V3 | null };
  const tags: Tag[] = [];
  function tag(html: string, at: V3, cls = '', dy = 0, follow?: () => V3 | null) { const el = document.createElement('div'); el.className = 'g-tag ' + cls; el.innerHTML = html; tagLayer.appendChild(el); const t: Tag = { el, at, dy, follow }; tags.push(t); return t; }
  const vaultTag = tag('', V(VAULT.x, 0, VAULT.z + 1.5), 'near');
  const slotTag = tag('Your stand<small>Coin Slot</small><b>0.10 NEAR</b>', V(STAND.x + 0.3, 0, STAND.z + 1.55));
  const splitTag = tag('Splitter<b>70 / 30</b>', V(SPLIT.x + 0.2, 0, SPLIT.z + 1.5));
  const portalTag = tag('Portal<small>sends payment to Ethereum</small>', V(PORTAL.top.x + 0.4, 0, PORTAL.top.z + 1.45));
  const mailTag = tag('Payout', V(MAILBOX.x, 0, MAILBOX.z + 1.0));
  const supTag = tag('', V(HUT.x - 0.8, 0, HUT.z + 1.9), 'eth');
  const nearTag = tag('NEAR island', V(-4, WATER_Y, 9.4), 'island');
  const ethTag = tag('Ethereum · another blockchain', V(ETH_ISLE.cx + 1, WATER_Y, ETH_ISLE.cz + ETH_ISLE.hz + 2.0), 'island');
  const realCoinTag = tag('', V(), 'kind-tag', -34, () => {
    let n = 0; tmpV.set(0, 0, 0);
    for (const c of coins) if (c.rec && c.rec.flow.kind !== 'sim' && c.st !== 'orbit' && c.st !== 'held') { tmpV.add(c.pos); n++; }
    return n ? tmpV.clone().multiplyScalar(1 / n) : null;
  });
  const custTag = tag('', V(), 'kind-tag cust', -64, () => (realCust && realCust.st !== 'gone' ? realCust.c.root.position.clone().setY(1.1) : null));
  type Floater = { el: HTMLElement; at: V3; t: number; life: number };
  const floaters: Floater[] = [];
  function floater(html: string, at: V3, cls: string, life = 1.6) { const el = document.createElement('div'); el.className = 'floater ' + cls; el.innerHTML = html; tagLayer.appendChild(el); floaters.push({ el, at: at.clone(), t: 0, life }); }
  let simVault = 0n, realVault = 0n, simWei = 0n, realWei = 0n, realKind: FlowKind = 'real';
  function updateTags() {
    const app = opts.variant === 'app';
    const simV = simVault > 0n || realVault === 0n ? `<b>${near(simVault)} NEAR</b>${simVault > 0n ? '<em>sim</em>' : ''}` : '';
    const simE = simWei > 0n || realWei === 0n ? `<b>${eth(simWei)} ETH</b>${simWei > 0n ? '<em>sim</em>' : ''}` : '';
    const v = `${app ? 'Vault' : 'Your savings'}<small>${app ? `“${vaultName}”` : `Vault${vaultName && vaultName !== 'reserve' ? ` “${vaultName}”` : ''}`}</small>${simV}${realVault > 0n ? `<b class="realamt">${near(realVault)} ${realKind === 'mock' ? 'MOCK' : 'REAL'}</b>` : ''}`;
    vaultTag.el.innerHTML = v;
    vaultTag.el.classList.toggle('starved', !parts0.splitter && opts.variant === 'game');
    supTag.el.innerHTML = `${app ? 'Paid out' : 'Your supplier'}<small>on Ethereum</small>${simE}${realWei > 0n ? `<b class="realamt">${eth(realWei)} ${realKind === 'mock' ? 'MOCK' : 'REAL'}</b>` : ''}`;
  }

  // ---------- audio (synth, no assets) ----------
  let ac: AudioContext | null = null, muted = true, quiet = false;
  function blip(freq: number, dur = 0.08, type: OscillatorType = 'sine', vol = 0.06, slide = 0) {
    if (muted || !ac || quiet) return;
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
  }

  // ---------- customers ----------
  const QUEUE: [number, number][] = [[-8.35, 0], [-9.2, 0.15], [-10.0, -0.25], [-10.55, -0.95], [-10.8, -1.85], [-10.6, -2.75]];
  const SPAWN = V(-10.35, 0, -4.9);
  const EXIT_PATH: [number, number][] = [[-8.35, 0], [-8.55, 1.35], [-9.4, 2.7], [-10.6, 3.7], [-11.6, 4.3]];
  type Cust = { c: ReturnType<typeof character>; st: 'queue' | 'pay' | 'leave' | 'gone' | 'realWalk' | 'realWait'; q: number; t: number; phase: number; exitI: number; pop: number; real: boolean };
  const custs: Cust[] = [];
  let realCust: Cust | null = null, realPayFlow: Flow | null = null;
  let lastSpawn = -9, simOn = opts.variant === 'game';
  function spawnCustomer(real = false) {
    const c = character(real ? '#16c08a' : SHIRT[Math.floor(rnd() * SHIRT.length)], SKIN[Math.floor(rnd() * SKIN.length)]);
    c.root.position.copy(SPAWN); c.root.position.y = 0;
    const cu: Cust = { c, st: real ? 'realWalk' : 'queue', q: custs.filter(k => k.st === 'queue' || k.st === 'pay').length, t: 0, phase: rnd() * 6, exitI: 1, pop: 0, real };
    custs.push(cu); return cu;
  }
  function walkTo(cu: Cust, x: number, z: number, dt: number, speed = 1.7) {
    const p = cu.c.root.position, dx = x - p.x, dz = z - p.z, dist = Math.hypot(dx, dz);
    if (dist < 0.03) { cu.c.body.position.y = lerp(cu.c.body.position.y, 0, 0.3); cu.c.body.scale.set(1, 1, 1); return true; }
    const stp = Math.min(dist, speed * dt); p.x += (dx / dist) * stp; p.z += (dz / dist) * stp;
    cu.c.root.rotation.y = Math.atan2(dx, dz);
    cu.phase += dt * 11; const h = Math.abs(Math.sin(cu.phase));
    cu.c.body.position.y = h * 0.13; cu.c.body.scale.set(1 + (1 - h) * 0.08, 1 - (1 - h) * 0.12, 1 + (1 - h) * 0.08);
    return false;
  }
  const groundY = (x: number, z: number) => (Math.abs(x + 0.5) < 7.9 && Math.abs(z) < 4.7 ? FLOOR : 0);

  // ---------- state ----------
  let simT = 0, standBusy = 0;
  let parts0: Parts = { splitter: true, vault: true, portal: true, payout: false };
  let vaultName = 'reserve';
  const emitQ: { rec: OrderRec; dest: Dest; at: number }[] = [];

  function tossCoin(from: [number, number], flow: Flow | null) {
    const c = newCoin('toss', null, 'A', flow?.kind ?? 'sim');
    if (c) { c.from.set(from[0] + 0.15, 0.55, from[1]); c.to.set(STAND.x - 0.8, FLOOR + 0.52, STAND.z); c.dur = 0.36; c.s = 1.25; c.tossFlow = flow ?? undefined; }
  }
  function startOrder(flow: Flow) {
    const rec: OrderRec = { flow, vaultIn: 0, portalIn: 0, payoutIn: 0 };
    const counts: Record<Dest, number> = { A: flow.vault, B: flow.portal, C: flow.payout, H: flow.held };
    const done: Record<Dest, number> = { A: 0, B: 0, C: 0, H: 0 };
    const n = counts.A + counts.B + counts.C + counts.H;
    for (let i = 0; i < n; i++) {
      let best: Dest = 'A', bestV = -1e9;
      for (const d of ['A', 'B', 'C', 'H'] as Dest[]) { if (done[d] >= counts[d]) continue; const want = ((i + 1) * counts[d]) / n - done[d]; if (want > bestV) { bestV = want; best = d; } }
      done[best]++;
      emitQ.push({ rec, dest: best, at: simT + 0.12 + i * 0.16 });
    }
    if (flow.kind !== 'sim') {
      realKind = flow.kind;
      if (flow.portal > 0) {
        const rj: RealJump = { key: flow.key, flow, need: flow.portal, inn: 0, want: pendingPhase.get(flow.key) ?? 'swirl', shown: 'none', t: 0, u: 0 };
        realJumps.set(flow.key, rj);
      }
    }
    kick(stand, flow.kind === 'sim' ? 5 : 8); burst(V(STAND.x - 0.8, FLOOR + 0.6, STAND.z), flow.kind === 'sim' ? 10 : 24, flow.kind === 'sim' ? '#ffe14d' : COIN_COLOR[flow.kind], 1.6, 2.2);
    blip(880, 0.09, 'triangle', 0.07, 1.5);
    if (captions) {
      const bits: string[] = [];
      if (flow.vault) bits.push(`<b>${flow.vault}</b> coin${flow.vault > 1 ? 's' : ''} → your savings`);
      if (flow.portal) bits.push(`<b>${flow.portal}</b> coin${flow.portal > 1 ? 's' : ''} → supplier`);
      if (flow.payout) bits.push(`<b>${flow.payout}</b> → ${flow.payoutTo ?? 'payout'}`);
      if (flow.held) bits.push(`<b>${flow.held}</b> held for approval`);
      if (!flow.vault && opts.variant === 'game') bits.push('you keep <b>0</b>');
      floater(bits.join(' · ') + (flow.kind === 'sim' ? '' : `<span class="sim">${KIND_LABEL[flow.kind]}</span>`), (parts0.splitter ? SPLIT.clone().add(V(-1.6, 2.2, 0)) : V(-3.2, 1.9, 0)), 'caption ' + flow.kind + (flow.vault ? '' : ' leak'), flow.kind === 'sim' ? 2.2 : 4);
    }
    if (flow.kind === 'sim') opts.onSale?.(flow);
  }
  function newCoin(st: Coin['st'], rec: OrderRec | null, dest: Dest, kind: FlowKind): Coin | null {
    if (coins.length >= MAX_COINS) return null;
    const c: Coin = { st, d: 0, t: 0, dur: 0, from: V(), to: V(), pos: V(), spin: rnd() * 6, flip: 0, s: kind === 'sim' ? 1 : 1.3, rec, dest, slot: -1, a: 0 };
    coins.push(c); return c;
  }
  function startJump(flow: Flow) {
    if (jump && !jump.popped) popGem(jump.flow);
    jump = { t: 0, flow, popped: false };
    kick(PORTAL.g, 6); blip(220, 0.5, 'sawtooth', 0.025, 3.2); shock(PORTAL.top.clone().setY(FLOOR + 0.4), '#c9b8ff', 2.4);
    if (punchEnabled && !quiet && simT - lastPunch > 13) { lastPunch = simT; punchT = 0; }
  }
  function popGem(flow: Flow) {
    kick(EXIT.g, 7); shake = 0.22; shock(EXIT.top.clone().setY(FLOOR + 0.4), '#ffffff', 3.6); shock(EXIT.top.clone().setY(FLOOR + 0.4), flow.kind === 'sim' ? '#9fb0ff' : COIN_COLOR[flow.kind], 2.6);
    const m = new THREE.Mesh(gemGeo, new THREE.MeshStandardMaterial({ color: GEM_COLOR[flow.kind], metalness: 0.35, roughness: 0.18, flatShading: true, emissive: flow.kind === 'sim' ? '#2e3bc4' : '#0b8a62', emissiveIntensity: 0.4 }));
    m.castShadow = true; scene.add(m);
    const slot = gemCount % GEM_MAX; flyingGems.push({ t: 0, m, slot, kind: flow.kind });
    burst(EXIT.top.clone().setY(FLOOR + 0.6), flow.kind === 'sim' ? 26 : 50, '#b9c3ff', 3, 4); burst(EXIT.top.clone().setY(FLOOR + 0.6), flow.kind === 'sim' ? 10 : 30, flow.kind === 'sim' ? '#ffffff' : COIN_COLOR[flow.kind], 2, 5);
    floater(`+${eth(flow.wei)} ETH<span class="sim">${KIND_LABEL[flow.kind]}</span>`, EXIT.top.clone().add(V(0, 1.6, 0)), 'eth ' + flow.kind, flow.kind === 'sim' ? 1.6 : 4);
    if (flow.kind === 'sim') simWei += flow.wei; else realWei += flow.wei;
    supplierHop = 1;
    blip(660, 0.14, 'sine', 0.08, 2.0);
    updateTags();
  }

  // ---------- camera ----------
  let portrait = false;
  const base = { target: V(), zoom: 1 };
  let shot: { target: V3; zoom: number } | null = null;
  let punchEnabled = true, punchT = -1, lastPunch = -99, shake = 0;
  const camDir = V();
  function layoutCamera() {
    const w = innerWidth, h = innerHeight; portrait = h > w * 1.15;
    applyFx();
    const az = THREE.MathUtils.degToRad(portrait ? 110 : 24), el = THREE.MathUtils.degToRad(portrait ? 52 : 40);
    camDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const app = opts.variant === 'app';
    const pts = portrait
      ? (app ? [V(-9.2, 0, 0.6), V(-7, 2.6, 0), V(4.4, 0, 4.3), V(5.6, 0, -4.6), V(13, 0, -9.6), V(19, 0, -8.5), V(17.5, 2.2, -8.7), V(16.5, 0, -3.8)]
        : [V(-10.6, 0, -2.4), V(-9.2, 0, 0.6), V(-7, 2.6, 0), V(4.4, 0, 4.3), V(5.6, 0, -4.6), V(13, 0, -9.6), V(19, 0, -8.5), V(17.5, 2.2, -8.7), V(16.5, 0, -3.8)])
      : (app ? [V(-9.6, 0, -1.6), V(-9.4, 0, 1.6), V(5.4, 0, 4.6), V(7.2, 0, -4.8), V(18.6, 0, -10.0), V(19.4, 0, -4.4), V(-7, 2.6, 0), V(17.5, 2.2, -9)]
        : [V(-11.2, 0, -4.6), V(-11.0, 0, 2.2), V(5.4, 0, 4.6), V(7.2, 0, -4.8), V(18.6, 0, -10.0), V(19.4, 0, -4.4), V(-7, 2.6, 0), V(17.5, 2.2, -9)]);
    const c0 = V(2, 0, -1);
    camera.position.copy(c0).addScaledVector(camDir, 80); camera.up.set(0, 1, 0); camera.lookAt(c0); camera.updateMatrixWorld();
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of pts) { const v = p.clone().applyMatrix4(camera.matrixWorldInverse); minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }
    const m = opts.margins?.(w, h, portrait) ?? (portrait ? { t: 205, b: 150, l: 4, r: 4 } : { t: 30, b: 84, l: 20, r: 20 });
    const s = Math.max((maxX - minX) / Math.max(80, w - m.l - m.r), (maxY - minY) / Math.max(80, h - m.t - m.b));
    const cx = (minX + maxX) / 2 - ((m.l - m.r) / 2) * s, cy = (minY + maxY) / 2 - ((m.b - m.t) / 2) * s;
    const right = V(1, 0, 0).applyQuaternion(camera.quaternion), up = V(0, 1, 0).applyQuaternion(camera.quaternion);
    base.target.copy(c0).addScaledVector(right, cx).addScaledVector(up, cy);
    base.zoom = 1;
    camera.left = (-w / 2) * s; camera.right = (w / 2) * s; camera.top = (h / 2) * s; camera.bottom = (-h / 2) * s;
    camera.updateProjectionMatrix();
    nearTag.el.style.display = ethTag.el.style.display = portrait ? 'none' : '';
  }
  const camTarget = V(); let camZoom = 1, smoothCam = false;
  let focusShot: { target: V3; zoom: number } | null = null;
  function applyCamera(dt: number) {
    let tgt = base.target, zm = base.zoom;
    if (shot) { tgt = shot.target; zm = shot.zoom; }
    else if (focusShot) { tgt = focusShot.target; zm = focusShot.zoom; }
    else if (punchT >= 0) {
      const k = punchT < 0.7 ? easeInOut(punchT / 0.7) : punchT < 2.4 ? 1 : 1 - easeInOut(Math.min(1, (punchT - 2.4) / 0.9));
      tgt = base.target.clone().lerp(V(10.2, 0.4, -4.9), k * 0.85); zm = lerp(base.zoom, base.zoom * (portrait ? 1.55 : 1.75), k);
    }
    if (smoothCam && dt > 0) { const k = 1 - Math.pow(0.02, dt); camTarget.lerp(tgt, k); camZoom = lerp(camZoom, zm, k); if (camTarget.distanceTo(tgt) < 0.01 && Math.abs(camZoom - zm) < 0.002) smoothCam = !!focusShot; }
    else { camTarget.copy(tgt); camZoom = zm; }
    zm = camZoom;
    const sx = (rnd() - 0.5) * shake, sy = (rnd() - 0.5) * shake; shake *= Math.pow(0.02, dt);
    camera.position.copy(camTarget).addScaledVector(camDir, 80); camera.lookAt(camTarget);
    camera.position.x += sx; camera.position.y += sy;
    camera.zoom = zm; camera.updateProjectionMatrix();
  }

  // ---------- simulation step ----------
  let armed = false, hover = false, captions = true;
  function step(dt: number) {
    simT += dt;
    waterU.t.value = simT; for (const m of swirlMats) m.uniforms.t.value = simT;
    for (const b of allBelts) if (b.powered && b.g.visible) for (const t of b.tex) t.offset.x -= (BELT_SPEED / 0.6) * dt;
    if (tile.visible) { const k = 0.5 + 0.5 * Math.sin(simT * 5); tileMat.opacity = hover ? 1 : 0.55 + 0.4 * k; tileFill.opacity = hover ? 0.45 : armed ? 0.16 + 0.16 * k : 0.08 + 0.08 * k; tile.scale.setScalar(hover ? 1.08 : 1); }

    // customers
    const inLine = custs.filter(k => k.st === 'queue' || k.st === 'pay');
    if (simOn && !realCust && inLine.length < QUEUE.length && simT - lastSpawn > 0.9) { spawnCustomer(); lastSpawn = simT; }
    inLine.forEach((k, i) => (k.q = i));
    for (const cu of custs) {
      if (cu.pop < 1) { cu.pop = Math.min(1, cu.pop + dt * 3); cu.c.root.scale.setScalar(easeOut(cu.pop) * 1.35); }
      if (cu.st === 'queue') {
        const [qx, qz] = QUEUE[Math.min(cu.q, QUEUE.length - 1)];
        const there = walkTo(cu, qx, qz, dt);
        if (there && cu.q === 0 && simOn && simT > standBusy) {
          const flow = opts.nextSimOrder?.() ?? null;
          if (flow) { cu.st = 'pay'; cu.t = 0; cu.c.root.rotation.y = Math.PI / 2; tossCoin([qx, qz], flow); }
        }
      } else if (cu.st === 'realWalk') {
        if (walkTo(cu, QUEUE[0][0], QUEUE[0][1], dt, 2.2)) { cu.st = 'realWait'; cu.c.root.rotation.y = Math.PI / 2; }
      } else if (cu.st === 'realWait') {
        cu.t += dt; cu.c.body.position.y = Math.abs(Math.sin(cu.t * 3)) * 0.05;
        if (realPayFlow && simT > standBusy) { tossCoin(QUEUE[0], realPayFlow); realPayFlow = null; cu.st = 'pay'; cu.t = 0; }
      } else if (cu.st === 'pay') {
        cu.t += dt; cu.c.body.rotation.x = Math.sin(Math.min(1, cu.t / 0.3) * Math.PI) * 0.25;
        if (cu.t > 0.55) { cu.st = 'leave'; cu.c.cup.visible = true; cu.c.body.rotation.x = 0; standBusy = simT + 1.25; if (cu === realCust) realCust = null; }
      } else if (cu.st === 'leave') {
        const [x, z] = EXIT_PATH[cu.exitI];
        if (walkTo(cu, x, z, dt, 1.5)) { cu.exitI++; if (cu.exitI >= EXIT_PATH.length) { cu.st = 'gone'; burst(cu.c.root.position.clone().setY(0.4), 8, '#ffffff', 1.2, 1.5, 4); scene.remove(cu.c.root); } }
      }
      if (cu.st !== 'gone') cu.c.root.position.y = groundY(cu.c.root.position.x, cu.c.root.position.z);
    }
    for (let i = custs.length - 1; i >= 0; i--) if (custs[i].st === 'gone') custs.splice(i, 1);
    if (supplierHop > 0) { supplierHop = Math.max(0, supplierHop - dt * 1.6); const h = Math.abs(Math.sin((1 - supplierHop) * Math.PI * 2)); supplier.body.position.y = h * 0.35 * supplierHop; }

    while (emitQ.length && emitQ[0].at <= simT) {
      const e = emitQ.shift()!; const c = newCoin('belt0', e.rec, e.dest, e.rec.flow.kind);
      if (c) { c.d = 0; blip(1320, 0.03, 'square', 0.012); if (e.rec.flow.kind !== 'sim' && rnd() < 0.5) burst(STAND.clone().setY(FLOOR + 0.5), 2, COIN_COLOR[e.rec.flow.kind], 0.6, 1); }
    }

    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.spin += dt * 2;
      const kind = c.rec?.flow.kind ?? 'sim';
      if (c.st !== 'toss' && kind !== 'sim' && rnd() < dt * 6) burst(c.pos, 1, COIN_COLOR[kind], 0.3, 0.6, 1, 0.7);
      if (c.st === 'toss') {
        c.t += dt; const k = clamp01(c.t / c.dur);
        c.pos.lerpVectors(c.from, c.to, k); c.pos.y += Math.sin(k * Math.PI) * 0.9; c.flip = k * Math.PI * 3;
        if (k >= 1) { coins.splice(i, 1); if (c.tossFlow) startOrder(c.tossFlow); continue; }
      } else if (c.st === 'belt0') {
        c.d += BELT_SPEED * dt; path0.at(c.d, c.pos);
        if (c.d >= path0.length) {
          if (c.dest === 'H') { c.st = 'held'; const k = coins.filter(x => x.st === 'held').length; c.pos.set(-1.3 + (k % 3) * 0.3, FLOOR + 0.1 + Math.floor(k / 3) * 0.07, 1.4 + (Math.floor(k / 9) % 2) * 0.3); c.flip = 0; continue; }
          if (parts0.splitter) {
            c.st = 'path'; c.d = 0; needleTarget = c.dest === 'A' ? 0.5 : c.dest === 'B' ? Math.PI - 0.5 : Math.PI / 2; kick(splitter, 1.6);
            burst(V(SPLIT.x + 0.8, FLOOR + 0.5, c.dest === 'A' ? 0.55 : c.dest === 'B' ? -0.55 : 0), 3, c.dest === 'A' ? '#ffd76a' : '#b9a8ff', 1.2, 1.6);
            blip(c.dest === 'A' ? 520 : 390, 0.05, 'triangle', 0.03);
          } else { c.st = 'hub'; c.t = 0; c.from.copy(c.pos); paths[c.dest].at(0.9, c.to); }
        }
      } else if (c.st === 'hub') {
        c.t += dt; const k = clamp01(c.t / 0.38);
        c.pos.lerpVectors(c.from, c.to, k); c.pos.y += Math.sin(k * Math.PI) * 0.7; c.flip = k * Math.PI * 2;
        if (k >= 1) { c.st = 'path'; c.d = 0.9; }
      } else if (c.st === 'path') {
        const p = paths[c.dest as 'A' | 'B' | 'C']; c.d += BELT_SPEED * dt; p.at(c.d, c.pos);
        if (c.d >= p.length) {
          if (c.dest === 'A') {
            c.st = 'hop'; c.t = 0; c.dur = 0.42; c.from.copy(c.pos);
            c.slot = Math.min(stackReserved++, STACK_MAX - 1);
            stackPos(c.slot, c.to);
          } else if (c.dest === 'B') { c.st = 'fall'; c.t = 0; c.from.copy(c.pos); }
          else { c.st = 'mail'; c.t = 0; c.from.copy(c.pos); c.to.set(MAILBOX.x - 0.46, MAILBOX.y + 1.03, MAILBOX.z); }
        }
      } else if (c.st === 'hop') {
        c.t += dt; const k = clamp01(c.t / c.dur);
        c.pos.lerpVectors(c.from, c.to, k); c.pos.y += Math.sin(k * Math.PI) * 1.1; c.flip = k * Math.PI * 2;
        if (k >= 1) {
          coins.splice(i, 1);
          if (gulpT < 0 && c.slot < STACK_MAX) {
            stackMesh.setMatrixAt(c.slot, tmpM.compose(stackPos(c.slot, tmpV), tmpQ.setFromEuler(tmpE.set(0, c.slot * 0.7, 0)), tmpS.set(1, 1, 1)));
            stackMesh.setColorAt(c.slot, colorOf[kind]); if (stackMesh.instanceColor) stackMesh.instanceColor.needsUpdate = true;
            stackCount = Math.max(stackCount, c.slot + 1); stackMesh.count = stackCount; stackMesh.instanceMatrix.needsUpdate = true;
          }
          kick(vault, 0.9); burst(c.to.clone().add(V(0, 0.05, 0)), 3, kind === 'sim' ? '#ffe27a' : COIN_COLOR[kind], 0.9, 1.2);
          blip(1560 + (c.slot % 5) * 90, 0.06, 'sine', 0.035);
          const r = c.rec!; r.vaultIn++;
          if (r.vaultIn === r.flow.vault) {
            if (kind === 'sim') simVault += r.flow.vaultYocto; else realVault += r.flow.vaultYocto;
            floater(`+${near(r.flow.vaultYocto)} NEAR${kind === 'sim' ? '' : `<span class="sim">${KIND_LABEL[kind]}</span>`}`, V(VAULT.x, VAULT.y + 2.4, VAULT.z), 'near ' + kind, kind === 'sim' ? 1.6 : 3.5);
            updateTags();
          }
          if (stackReserved >= STACK_MAX - 6 && gulpT < 0) gulpT = 0;
          continue;
        }
      } else if (c.st === 'mail') {
        c.t += dt; const k = clamp01(c.t / 0.4);
        c.pos.lerpVectors(c.from, c.to, k); c.pos.y += Math.sin(k * Math.PI) * 0.8; c.flip = k * Math.PI * 2; c.s = (kind === 'sim' ? 1 : 1.3) * (1 - k * 0.6);
        if (k >= 1) {
          coins.splice(i, 1); kick(mailbox, 1.2); blip(980, 0.05, 'triangle', 0.03);
          const r = c.rec!; r.payoutIn++;
          if (r.payoutIn === r.flow.payout) floater(`+${near(r.flow.payoutYocto)} NEAR → ${r.flow.payoutTo ?? 'payout'}${kind === 'sim' ? '' : `<span class="sim">${KIND_LABEL[kind]}</span>`}`, MAILBOX.clone().add(V(0, 2, 0)), 'near ' + kind, 3);
          continue;
        }
      } else if (c.st === 'fall') {
        c.t += dt; const k = clamp01(c.t / 0.5);
        const a = k * Math.PI * 3, r = (1 - k) * 0.95;
        c.pos.set(PORTAL.top.x - Math.cos(a) * r, lerp(c.from.y, PORTAL.top.y - 0.25, easeOut(k)) + Math.sin(k * Math.PI) * 0.35, PORTAL.top.z + Math.sin(a) * r * 0.9);
        c.s = (kind === 'sim' ? 1 : 1.3) * (1 - k * k * (kind === 'sim' ? 1 : 0.4)); c.flip = k * 6;
        if (k >= 1) {
          kick(PORTAL.g, 1.4); burst(PORTAL.top.clone().add(V(0, 0.1, 0)), 4, '#c9b8ff', 1, 1.4);
          const rec = c.rec!; blip(300 - rec.portalIn * 40, 0.12, 'sine', 0.04, 0.6);
          rec.portalIn++;
          if (kind === 'sim') { coins.splice(i, 1); if (rec.portalIn === rec.flow.portal) startJump(rec.flow); continue; }
          const rj = realJumps.get(rec.flow.key);
          if (rj) { rj.inn++; c.st = 'orbit'; c.a = rj.inn * 2.1; }
          else { coins.splice(i, 1); }
          continue;
        }
      } else if (c.st === 'orbit') {
        c.a += dt * 3.2;
        const rj = c.rec ? realJumps.get(c.rec.flow.key) : undefined;
        const failed = rj?.shown === 'failed';
        c.pos.set(PORTAL.top.x + Math.cos(c.a) * 0.5, PORTAL.top.y + 0.28 + Math.sin(c.a * 2) * 0.06 - (failed ? 0.15 : 0), PORTAL.top.z + Math.sin(c.a) * 0.5);
        c.flip = 0.5; c.s = 1.05;
        if (rj && (rj.shown === 'beam' || rj.shown === 'travel' || rj.shown === 'popped')) { c.st = 'suck'; c.t = 0; c.from.copy(c.pos); }
      } else if (c.st === 'suck') {
        c.t += dt; const k = clamp01(c.t / 0.35);
        c.pos.lerpVectors(c.from, PORTAL.top.clone().setY(PORTAL.top.y - 0.1), easeOut(k)); c.s = 1.05 * (1 - k);
        if (k >= 1) { coins.splice(i, 1); burst(PORTAL.top, 4, COIN_COLOR[kind], 1, 1.6); continue; }
      }
    }

    if (gulpT >= 0) {
      gulpT += dt; const k = clamp01(gulpT / 0.6);
      for (let j = 0; j < stackCount; j++) { stackPos(j, tmpV); tmpV.y = lerp(tmpV.y, VAULT.y + VB, k); tmpM.compose(tmpV, tmpQ.setFromEuler(tmpE.set(0, j * 0.7, 0)), tmpS.setScalar(1 - k)); stackMesh.setMatrixAt(j, tmpM); }
      stackMesh.instanceMatrix.needsUpdate = true;
      if (k >= 1) { gulpT = -1; stackCount = 0; stackMesh.count = 0; stackReserved = coins.filter(c => c.st === 'hop').length; kick(vault, 6); }
    }
    needle.rotation.y = lerp(needle.rotation.y, needleTarget, 1 - Math.pow(0.0005, dt));

    // simulated jump: charge -> beam -> pop -> fade (only when no real payout owns the beam)
    for (const m of swirlMats) m.uniforms.glow.value *= Math.pow(0.1, dt);
    if (jump && !beamOwner) {
      jump.t += dt; const t = jump.t;
      PORTAL.sm.uniforms.glow.value = Math.max(PORTAL.sm.uniforms.glow.value, t < 0.3 ? t / 0.3 : 0);
      const fly = clamp01((t - 0.25) / 0.85);
      beamU.head.value = t < 0.25 ? -1 : easeInOut(fly) * 1.02;
      beamU.fade.value = t < 1.1 ? 1 : Math.max(0, 1 - (t - 1.1) / 0.6);
      orb.visible = orbCore.visible = t >= 0.25 && t < 1.1;
      if (orb.visible) { beamCurve.getPoint(easeInOut(fly), orb.position); orbCore.position.copy(orb.position); orbCore.rotation.y += dt * 8; if (rnd() < 0.6) burst(orb.position, 1, '#d8d0ff', 0.4, 0.2, 1, 0.8); }
      if (t >= 1.1 && !jump.popped) { EXIT.sm.uniforms.glow.value = 1; jump.popped = true; popGem(jump.flow); }
      if (t > 1.8) { jump = null; beamU.fade.value = 0; }
    } else if (jump && beamOwner) { jump = null; }
    stepRealJumps(dt);

    for (let i = flyingGems.length - 1; i >= 0; i--) {
      const g = flyingGems[i]; g.t += dt;
      gemSlot(g.slot, tmpV); const t = g.t;
      if (t < 0.35) { const k = t / 0.35; g.m.position.set(EXIT.top.x, EXIT.top.y + easeOut(k) * 1.7, EXIT.top.z); g.m.scale.set(0.6 + k * 0.6, 0.6 + k * 1.0, 0.6 + k * 0.6); }
      else { const k = clamp01((t - 0.35) / 0.55); g.m.position.set(lerp(EXIT.top.x, tmpV.x, k), lerp(EXIT.top.y + 1.7, tmpV.y, k * k) + Math.sin(k * Math.PI) * 0.7, lerp(EXIT.top.z, tmpV.z, k)); g.m.scale.setScalar(1.15 - 0.15 * k); }
      g.m.rotation.y += dt * 9;
      if (t > 0.9) {
        scene.remove(g.m); flyingGems.splice(i, 1);
        if (gemCount >= GEM_MAX) gemCount = 0;
        tmpM.compose(tmpV, tmpQ.setFromEuler(tmpE.set(0, g.slot, 0)), tmpS.set(1, 1.5, 1)); gemPile.setMatrixAt(g.slot, tmpM);
        gemPile.setColorAt(g.slot, GEM_COLOR[g.kind]); if (gemPile.instanceColor) gemPile.instanceColor.needsUpdate = true;
        gemCount++; gemPile.count = Math.max(gemPile.count, gemCount); gemPile.instanceMatrix.needsUpdate = true;
        burst(tmpV, 6, '#c9d0ff', 1, 1.5); blip(990, 0.08, 'triangle', 0.04);
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life += dt; if (p.life > p.max) { parts.splice(i, 1); continue; } p.v.y -= p.g * dt; p.p.addScaledVector(p.v, dt); }
    for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.t += dt; f.at.y += dt * (f.life > 2 ? 0.35 : 0.9); if (f.t > f.life) { f.el.remove(); floaters.splice(i, 1); } }
    stepSprings(dt);
    if (punchT >= 0) { punchT += dt; if (punchT > 3.3) punchT = -1; }
    for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; const k = clamp01(r.t / 0.6); r.m.scale.setScalar(1 + easeOut(k) * r.max); (r.m.material as THREE.MeshBasicMaterial).opacity = 1 - k; if (k >= 1) { scene.remove(r.m); rings.splice(i, 1); } }
  }

  function stepRealJumps(dt: number) {
    for (const rj of realJumps.values()) {
      rj.t += dt;
      const ready = rj.inn >= rj.need;
      if (!ready) continue;
      if (rj.shown === 'none') { rj.shown = 'swirl'; rj.t = 0; kick(PORTAL.g, 4); }
      if (rj.want === 'failed' && rj.shown !== 'failed' && rj.shown !== 'popped') {
        rj.shown = 'failed'; rj.t = 0; shake = 0.12; burst(PORTAL.top, 18, '#ff7966', 2, 2.5); blip(140, 0.4, 'sawtooth', 0.04, 0.5);
        floater('signature failed · no ETH sent', PORTAL.top.clone().add(V(0, 1.8, 0)), 'fail', 4);
        if (beamOwner === rj) beamOwner = null;
      }
      if (rj.shown === 'failed' && rj.want !== 'failed') { rj.shown = 'swirl'; rj.t = 0; }
      if (rj.shown === 'swirl' && rj.t > 1.2 && (rj.want === 'beam' || rj.want === 'pop')) {
        rj.shown = 'beam'; rj.t = 0; rj.u = 0; beamOwner = rj; jump = null;
        kick(PORTAL.g, 6); blip(220, 0.5, 'sawtooth', 0.025, 3.2); shock(PORTAL.top.clone().setY(FLOOR + 0.4), '#c9b8ff', 2.4);
      }
      if (rj.shown === 'beam' && rj.want === 'pop' && rj.t > 1.0) { rj.shown = 'travel'; rj.t = 0; }
      if (rj.shown === 'travel' && rj.t >= 0.9) {
        rj.shown = 'popped'; rj.t = 0; EXIT.sm.uniforms.glow.value = 1; popGem(rj.flow); poppedKeys.push(rj.key);
        if (!quiet && punchEnabled) { lastPunch = simT; punchT = 0; }
        opts.onPortalDone?.(rj.key);
      }
      // visuals
      const sm = PORTAL.sm.uniforms;
      if (rj.shown === 'failed') { (sm.c1.value as THREE.Color).set('#c0392b'); (sm.c2.value as THREE.Color).set('#ff9a8a'); sm.glow.value = 0.2 + 0.2 * Math.abs(Math.sin(simT * 9)); }
      else { (sm.c1.value as THREE.Color).copy(PORTAL.c1); (sm.c2.value as THREE.Color).copy(PORTAL.c2); }
      if (rj.shown === 'swirl') sm.glow.value = Math.max(sm.glow.value, 0.45 + 0.35 * Math.sin(simT * 5));
      if (beamOwner === rj) {
        if (rj.shown === 'beam') {
          const head = easeInOut(clamp01(rj.t / 0.85));
          beamU.head.value = head * 1.02; beamU.fade.value = 0.85 + 0.15 * Math.sin(simT * 4);
          sm.glow.value = Math.max(sm.glow.value, 0.7);
          EXIT.sm.uniforms.glow.value = Math.max(EXIT.sm.uniforms.glow.value, 0.3 + 0.2 * Math.sin(simT * 4));
          // the payload hovers over the water while Sepolia mines it: loops between 15% and 85% of the arc
          rj.u = rj.t < 0.85 ? head * 0.5 : 0.15 + 0.7 * (0.5 + 0.5 * Math.sin((rj.t - 0.85) * 1.6 - Math.PI / 2 + Math.asin(0.0)));
          orb.visible = orbCore.visible = rj.t > 0.25;
        } else if (rj.shown === 'travel') {
          const k = easeInOut(clamp01(rj.t / 0.9)); rj.u = lerp(rj.u, 1, k);
          beamU.head.value = 1.02; beamU.fade.value = 1; orb.visible = orbCore.visible = true;
        } else if (rj.shown === 'popped') {
          beamU.fade.value = Math.max(0, 1 - rj.t / 0.6); orb.visible = orbCore.visible = false;
          if (rj.t > 0.7) { beamOwner = null; beamU.fade.value = 0; }
        }
        if (orb.visible) { beamCurve.getPoint(clamp01(rj.u), orb.position); orbCore.position.copy(orb.position); orbCore.rotation.y += dt * 8; (orbCore.material as THREE.MeshStandardMaterial).color.copy(GEM_COLOR[rj.flow.kind]); if (rnd() < 0.6) burst(orb.position, 1, '#d8d0ff', 0.4, 0.2, 1, 0.8); }
      }
      if (rj.shown === 'popped' && rj.t > 2) realJumps.delete(rj.key);
    }
    if (!beamOwner && !jump) { orb.visible = orbCore.visible = false; }
  }

  // ---------- draw ----------
  const proj = V();
  const frameCbs = new Set<() => void>();
  let W = innerWidth, H = innerHeight;
  function draw(dt: number) {
    applyCamera(dt);
    let n = 0;
    for (const c of coins) {
      tmpQ.setFromEuler(tmpE.set(c.flip, c.spin, 0)); tmpM.compose(c.pos, tmpQ, tmpS.setScalar(c.s)); coinMesh.setMatrixAt(n, tmpM);
      coinMesh.setColorAt(n, colorOf[c.rec?.flow.kind ?? (c.tossFlow?.kind ?? 'sim')]); n++;
    }
    coinMesh.count = n; coinMesh.instanceMatrix.needsUpdate = true; if (coinMesh.instanceColor) coinMesh.instanceColor.needsUpdate = true;
    n = 0;
    for (const p of parts) { const k = 1 - p.life / p.max; tmpM.compose(p.p, tmpQ.setFromEuler(tmpE.set(p.life * 6, p.life * 4, 0)), tmpS.setScalar(p.s * k)); pMesh.setMatrixAt(n, tmpM); pMesh.setColorAt(n, p.c); n++; }
    pMesh.count = n; pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
    renderer.render(scene, camera);
    W = innerWidth; H = innerHeight;
    const mg = opts.margins?.(W, H, portrait); const maxX = W - (mg && mg.r > 100 ? mg.r : 0);
    for (const t of tags) {
      let at: V3 | null = t.at;
      if (t.follow) { at = t.follow(); t.el.style.display = at ? '' : 'none'; if (!at) continue; }
      if (t.el.style.display === 'none' && !t.follow) continue;
      proj.copy(at).project(camera); const hw = (t.el.offsetWidth || 80) / 2 + 6;
      t.el.style.left = Math.min(maxX - hw, Math.max(hw, ((proj.x + 1) / 2) * W)) + 'px'; t.el.style.top = ((1 - proj.y) / 2) * H + t.dy + 'px';
    }
    for (const f of floaters) { proj.copy(f.at).project(camera); f.el.style.left = ((proj.x + 1) / 2) * W + 'px'; f.el.style.top = ((1 - proj.y) / 2) * H + 'px'; f.el.style.opacity = String(f.t < f.life - 0.5 ? 1 : (f.life - f.t) / 0.5); }
    frameCbs.forEach(cb => cb());
  }

  // ---------- loop, fx fallback, hooks ----------
  let paused = false, last = performance.now(), raf = 0, bootAt = performance.now();
  const fpsWin: { t: number; dt: number }[] = [];
  function frame(now: number) {
    const real = Math.max(0, (now - last) / 1000); last = now;
    if (!paused) {
      let left = Math.min(real, 0.25);
      while (left > 1e-6) { const d = Math.min(1 / 30, left); step(d); left -= d; }
      if (!fxHigh && fx < 2 && document.visibilityState === 'visible' && now - bootAt > 2500) {
        fpsWin.push({ t: now, dt: real }); while (fpsWin.length && now - fpsWin[0].t > 3000) fpsWin.shift();
        if (fpsWin.length > 3 && now - fpsWin[0].t > 2900) {
          const fps = fpsWin.length / fpsWin.reduce((a, x) => a + x.dt, 0);
          if (fps < 30) { fx++; fpsWin.length = 0; applyFx(); opts.onFx?.(fx); }
        }
      }
    }
    draw(paused ? 0 : real);
    raf = requestAnimationFrame(frame);
  }
  const onResize = () => layoutCamera();
  addEventListener('resize', onResize);
  const SHOTS: Record<string, () => { target: V3; zoom: number }> = {
    splitter: () => ({ target: V(0.9, 0.3, 0.6), zoom: portrait ? 2.2 : 2.6 }),
    portal: () => ({ target: V(9.8, 0.6, -4.9), zoom: portrait ? 1.5 : 1.75 }),
    stand: () => ({ target: V(-6.5, 0.6, 0), zoom: portrait ? 1.8 : 2.2 }),
  };
  const hooks = {
    advance(sec: number, q = true) { quiet = q; const n = Math.round(sec * 30); for (let i = 0; i < n; i++) step(1 / 30); quiet = false; draw(0); },
    pause(p: boolean) { paused = p; last = performance.now(); },
    setShot(name: string | null) { shot = name ? SHOTS[name]() : null; draw(0); },
    punch(on: boolean) { punchEnabled = on; },
    info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, fx, pixelRatio: renderer.getPixelRatio(), shadows: renderer.shadowMap.enabled }),
    state: () => ({ simT, coins: coins.length, stack: stackCount, gems: gemCount, simVault: simVault.toString(), realVault: realVault.toString(), realWei: realWei.toString(), splitter: parts0.splitter, popped: [...poppedKeys], cust: realCust?.st ?? null, payFlow: !!realPayFlow, standBusy, emitQ: emitQ.length, simOn, real: [...realJumps.values()].map(r => ({ key: r.key, want: r.want, shown: r.shown, inn: r.inn, need: r.need })) }),
  };
  (window as unknown as { __ww: unknown }).__ww = hooks;

  // Merge static meshes by material, per root, so toggleable groups stay toggleable.
  function mergeUnder(root: THREE.Object3D, skip: Set<THREE.Object3D>) {
    root.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert();
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>(); const kill: THREE.Mesh[] = [];
    root.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material) || !(m.material instanceof THREE.MeshStandardMaterial) || m.material.transparent) return;
      for (let a: THREE.Object3D | null = m; a && a !== root; a = a.parent) if (skip.has(a)) return;
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) { g = g.clone(); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      if (!buckets.has(m.material)) buckets.set(m.material, []); buckets.get(m.material)!.push(g); kill.push(m);
    });
    for (const m of kill) m.parent!.remove(m);
    for (const [material, geos] of buckets) { const merged = mergeGeometries(geos, false); if (!merged) continue; const mm = new THREE.Mesh(merged, material); mm.castShadow = mm.receiveShadow = true; root.add(mm); }
  }
  {
    const toggles = [stand, splitter, vault, mailbox, PORTAL.g, EXIT.g, tile, ...allBelts.map(b => b.g)];
    mergeUnder(scene, new Set<THREE.Object3D>([...toggles, needle, orbCore, beam, water, supplier.root]));
    for (const g of [vault, mailbox, ...allBelts.map(b => b.g)]) mergeUnder(g, new Set());
    mergeUnder(splitter, new Set([needle]));
  }

  function setParts(p: Parts) {
    const hadSplitter = parts0.splitter;
    parts0 = p; vaultName = p.vaultName ?? 'reserve';
    splitter.visible = p.splitter; splitTag.el.style.display = p.splitter ? '' : 'none';
    if (p.splitLabel) splitTag.el.innerHTML = `Splitter<b>${p.splitLabel}</b>`;
    if (p.vaultShare !== undefined && (p.vaultShare !== splitShare)) { splitShare = p.vaultShare; splitLabel = String(Math.round(p.vaultShare * 100)); redraws.forEach(f => f()); }
    vault.visible = p.vault; vaultTag.el.style.display = p.vault ? '' : 'none';
    belts.A.g.visible = p.vault; belts.A.powered = p.vault && p.splitter;
    for (const m of belts.A.mats) m.opacity = belts.A.powered ? 1 : 0.25;
    PORTAL.g.visible = EXIT.g.visible = p.portal; belts.B.g.visible = p.portal; portalTag.el.style.display = p.portal ? '' : 'none';
    mailbox.visible = belts.C.g.visible = p.payout; mailTag.el.style.display = p.payout ? '' : 'none';
    if (p.priceLabel) slotTag.el.innerHTML = opts.variant === 'game' ? `Your stand<small>Coin Slot</small><b>${p.priceLabel}</b>` : `Coin Slot<small>pay here</small><b>${p.priceLabel}</b>`;
    supTag.el.style.display = p.portal ? '' : 'none';
    if (!hadSplitter && p.splitter) splitter.userData.base = 1;
    updateTags();
  }

  let disposed = false;
  const world: World = {
    setParts,
    setArmed(on) { armed = on; tile.visible = on || (!parts0.splitter && opts.variant === 'game'); },
    setHover(on) { hover = on; },
    hitSlot(x, y) { const s = world.screen('slot'); const r = Math.max(56, Math.min(W, H) * 0.09); return Math.hypot(s.x - x, s.y - y) < r; },
    placeSplitter() {
      setParts({ ...parts0, splitter: true });
      tile.visible = false; armed = false; hover = false;
      splitter.userData.sx = -0.3; kick(splitter, 14);
      shock(SPLIT.clone().setY(FLOOR + 0.2), '#2ec4b6', 2.6); burst(SPLIT.clone().setY(FLOOR + 0.8), 30, '#7ff5e9', 2.6, 4);
      blip(520, 0.12, 'triangle', 0.08, 1.6); setTimeout(() => blip(780, 0.16, 'triangle', 0.07, 1.3), 120);
    },
    setSimCustomers(on) {
      simOn = on;
      if (!on) for (const cu of custs) if (cu.st === 'queue') { cu.st = 'leave'; cu.exitI = 1; }
    },
    callRealCustomer(label) {
      world.setSimCustomers(false);
      if (realCust && realCust.st !== 'gone') return;
      realCust = spawnCustomer(true); custTag.el.innerHTML = label;
    },
    payReal(flow) {
      if (!realCust) world.callRealCustomer(flow.kind === 'mock' ? 'MOCK customer' : 'REAL customer');
      realPayFlow = flow;
      realCoinTag.el.innerHTML = flow.kind === 'mock' ? 'MOCK coins' : 'REAL coins · testnet';
      realCoinTag.el.className = 'g-tag kind-tag ' + flow.kind;
    },
    realCustomerLeave() { if (realCust && (realCust.st === 'realWait' || realCust.st === 'realWalk')) { realCust.st = 'leave'; realCust.exitI = 1; realCust = null; } },
    setPortal(key, phase) { pendingPhase.set(key, phase); const rj = realJumps.get(key); if (rj) rj.want = phase; },
    releaseHeld() { for (const c of coins) if (c.st === 'held') { c.st = 'suck'; c.t = 0; c.from.copy(c.pos); } },
    screen(a) {
      const p = a === 'slot' ? SPLIT.clone().setY(FLOOR + 0.4) : a === 'stand' ? STAND.clone().setY(2.6) : a === 'vault' ? VAULT.clone().setY(2.2) : a === 'portal' ? PORTAL.top.clone().setY(1.6) : a === 'exit' ? EXIT.top.clone().setY(1.8) : a === 'mailbox' ? MAILBOX.clone().setY(1.8) : a === 'supplier' ? HUT.clone().setY(1.6) : a === 'splitter' ? SPLIT.clone().setY(1.0) : a === 'customer' ? (realCust ? realCust.c.root.position.clone().setY(1.2) : V(QUEUE[0][0], 1.2, QUEUE[0][1])) : beamCurve.getPoint(0.5);
      p.project(camera);
      return { x: ((p.x + 1) / 2) * W, y: ((1 - p.y) / 2) * H, visible: p.z < 1 };
    },
    onFrame(cb) { frameCbs.add(cb); return () => frameCbs.delete(cb); },
    focus(f) {
      const P: Record<string, () => { target: V3; zoom: number }> = {
        stand: () => ({ target: V(-6.2, 0.6, 0.2), zoom: portrait ? 1.9 : 2.1 }),
        portal: () => ({ target: V(8.5, 0.5, -4.6), zoom: portrait ? 1.35 : 1.5 }),
        slot: () => ({ target: V(0.6, 0.3, 0.2), zoom: portrait ? 1.9 : 2.2 }),
        vault: () => ({ target: V(3.4, 0.6, 2.4), zoom: portrait ? 1.9 : 2.2 }),
        eth: () => ({ target: V(15.5, 0.5, -7), zoom: portrait ? 1.6 : 1.9 }),
      };
      focusShot = f ? P[f]() : null; smoothCam = true;
    },
    pick(x, y) {
      let best: Anchor | null = null, bd = Math.max(48, Math.min(W, H) * 0.07);
      const cands: Anchor[] = ['stand', 'vault', 'portal', 'exit', 'supplier', 'mailbox', 'splitter'];
      for (const a of cands) {
        if ((a === 'vault' && !vault.visible) || ((a === 'portal' || a === 'exit') && !PORTAL.g.visible) || (a === 'mailbox' && !mailbox.visible) || (a === 'splitter' && !splitter.visible)) continue;
        const s = world.screen(a); const d = Math.hypot(s.x - x, s.y - y);
        if (d < bd) { bd = d; best = a; }
      }
      return best;
    },
    setCaptions(on) { captions = on; },
    setMuted(m) { muted = m; if (!m && !ac) { try { ac = new AudioContext(); } catch { ac = null; } } },
    relayout: layoutCamera,
    fxLevel: () => fx,
    dispose() {
      if (disposed) return; disposed = true;
      cancelAnimationFrame(raf); removeEventListener('resize', onResize);
      for (const t of tags) t.el.remove(); for (const f of floaters) f.el.remove();
      scene.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
      envTex.dispose(); pmrem.dispose(); renderer.dispose();
      void ac?.close().catch(() => {});
      const w = window as unknown as { __ww?: unknown }; if (w.__ww === hooks) delete w.__ww;
    },
  };

  setParts(parts0);
  layoutCamera();
  void Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise(r => setTimeout(r, 1500))]).then(() => { if (!disposed) { redraws.forEach(f => f()); updateTags(); } });
  raf = requestAnimationFrame(t => { last = t; bootAt = t; frame(t); });
  return world;
}
