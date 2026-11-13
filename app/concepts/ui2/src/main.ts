// WORLDWORKS UI-2 concept: the Lemonade level as a living 2.5D toy factory.
// SIMULATED ONLY. Every order is routed by the real engine wasm (sim.ts); no chain is touched.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bootEngine, simulateOrder, fmtNear, fmtEth, PRICE, type SimOrder } from './sim';

type V3 = THREE.Vector3;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const params = new URLSearchParams(location.search);

// ---------- deterministic rng ----------
let seed = 7;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------- renderer / scene ----------
const canvas = document.getElementById('world') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#3f979d');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);

scene.add(new THREE.HemisphereLight('#fff7e8', '#4f9f98', 1.15));
const sun = new THREE.DirectionalLight('#fff0d6', 3.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 120 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
sun.target.position.set(3, 0, -1);
sun.position.set(3 - 14, 26, -1 - 5);

// ---------- palette / helpers ----------
const C = {
  grass: '#8cc862', grassDark: '#7fbf55', cliff: '#b8977a', cliffDark: '#987a60', sand: '#f6e3b4',
  floor: '#f4ecdc', belt: '#2d3040', rail: '#ff8a3d', coin: '#ffc53a',
  slot: '#ffd23f', awningA: '#ff6f91', awningB: '#fff6ec', split: '#2ec4b6', vault: '#6f61b8', vaultDark: '#4e4390',
  portal: '#8b5cf6', portalDark: '#3a2f6b', eth: '#6f7ff0', ethDark: '#2f3a7a', ethTop: '#dfe3fb', ethCliff: '#7c86c4',
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
/** rounded box with its bottom at y */
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

// springy squash & stretch for any object whose origin sits on the floor
const springs: THREE.Object3D[] = [];
function springy(o: THREE.Object3D) { o.userData.sx = 0; o.userData.sv = 0; springs.push(o); return o; }
function kick(o: THREE.Object3D, v = 4) { o.userData.sv += v; }
function stepSprings(dt: number) {
  for (const o of springs) {
    const u = o.userData; const a = -260 * u.sx - 14 * u.sv; u.sv += a * dt; u.sx += u.sv * dt;
    const s = THREE.MathUtils.clamp(u.sx, -0.35, 0.35); o.scale.set(1 + s * 0.6, 1 - s, 1 + s * 0.6);
  }
}

const FLOOR = 0.12;
const BELT_TOP = FLOOR + 0.1;
const WATER_Y = -0.9;

// ---------- water ----------
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
water.rotation.x = -Math.PI / 2; water.position.y = WATER_Y; water.receiveShadow = false; scene.add(water);

// ---------- islands ----------
function island(i: Isle, top: string, cliff: string, cliffLow: string) {
  const w = i.hx * 2, d = i.hz * 2;
  rbox(w + 1.5, 0.32, d + 1.5, C.sand, i.cx, WATER_Y - 0.22, i.cz, scene, 0.7);
  rbox(w, 0.9, d, cliffLow, i.cx, WATER_Y - 0.1, i.cz, scene, 0.6);
  rbox(w - 0.1, 0.5, d - 0.1, cliff, i.cx, -0.62 + 0.05, i.cz, scene, 0.5);
  rbox(w, 0.4, d, top, i.cx, -0.38, i.cz, scene, 0.4).receiveShadow = true;
}
island(NEAR_ISLE, C.grass, C.cliff, C.cliffDark);
// grass tufts
for (let k = 0; k < 70; k++) { const x = NEAR_ISLE.cx + (rnd() * 2 - 1) * (NEAR_ISLE.hx - 0.4), z = NEAR_ISLE.cz + (rnd() * 2 - 1) * (NEAR_ISLE.hz - 0.4); if (Math.abs(x + 0.5) < 8.4 && Math.abs(z) < 5.0) continue; const t = mesh(new THREE.ConeGeometry(0.09, 0.26, 4), mat(C.grassDark, { flatShading: true }), x, 0.1, z); t.castShadow = false; }
island(ETH_ISLE, '#c3cbf2', C.ethCliff, '#5f69a8');

// factory floor plate with a tile grid
const gridTex = canvasTex(256, 256, c => {
  c.fillStyle = C.floor; c.fillRect(0, 0, 256, 256);
  c.strokeStyle = 'rgba(160,130,90,0.22)'; c.lineWidth = 4; c.strokeRect(0, 0, 256, 256);
  c.fillStyle = 'rgba(160,130,90,0.18)'; for (const [x, y] of [[0, 0], [256, 0], [0, 256], [256, 256]]) { c.beginPath(); c.arc(x, y, 14, 0, 7); c.fill(); }
});
gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
{
  const fw = 15.8, fd = 9.4, fx = -0.5, fz = 0;
  const t = gridTex.clone(); t.repeat.set(fw, fd); t.needsUpdate = true;
  const plate = rbox(fw, FLOOR + 0.02, fd, mat('#ffffff', { map: t }), fx, -0.02, fz, scene, 0.18);
  plate.castShadow = false;
  rbox(fw + 0.3, 0.1, fd + 0.3, '#e1d3b8', fx, -0.04, fz, scene, 0.2).castShadow = false;
}
// paved disc on the ETH island
rbox(5.6, FLOOR + 0.02, 5.0, '#eef0fc', 15.7, -0.02, -6.9, scene, 0.9).castShadow = false;

// ---------- paths ----------
class Path {
  pts: V3[] = []; cum: number[] = []; length = 0;
  constructor(raw: [number, number][], y: number, r = 0.42) {
    const P = raw.map(([x, z]) => V(x, y, z));
    this.pts.push(P[0]);
    for (let i = 1; i < P.length - 1; i++) {
      const a = P[i - 1], b = P[i], c = P[i + 1];
      const din = b.clone().sub(a).normalize(), dout = c.clone().sub(b).normalize();
      const p0 = b.clone().addScaledVector(din, -r), p2 = b.clone().addScaledVector(dout, r);
      for (let k = 0; k <= 8; k++) {
        const t = k / 8, u = 1 - t;
        this.pts.push(V(u * u * p0.x + 2 * u * t * b.x + t * t * p2.x, y, u * u * p0.z + 2 * u * t * b.z + t * t * p2.z));
      }
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
  end() { return this.pts[this.pts.length - 1]; }
}

// belts: dark track, orange rails, scrolling chevrons
const chevronImg = canvasTex(128, 128, c => {
  c.clearRect(0, 0, 128, 128); c.strokeStyle = 'rgba(150,160,190,0.55)'; c.lineWidth = 14; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(42, 34); c.lineTo(78, 64); c.lineTo(42, 94); c.stroke();
});
const beltTextures: THREE.Texture[] = [];
const BELT_SPEED = 2.2;
function belt(raw: [number, number][]) {
  const W = 0.72;
  for (let i = 0; i < raw.length - 1; i++) {
    const a = V(raw[i][0], 0, raw[i][1]), b = V(raw[i + 1][0], 0, raw[i + 1][1]);
    const len = a.distanceTo(b), mid = a.clone().add(b).multiplyScalar(0.5), ang = Math.atan2(-(b.z - a.z), b.x - a.x);
    const g = group(mid.x, FLOOR, mid.z); g.rotation.y = ang;
    rbox(len + W, 0.1, W, C.belt, 0, 0, 0, g, 0.05);
    for (const s of [-1, 1]) rbox(len, 0.17, 0.08, C.rail, 0, 0, s * (W / 2 + 0.02), g, 0.035);
    const tex = chevronImg.clone(); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(len / 0.6, 1); tex.needsUpdate = true; beltTextures.push(tex);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(len, W * 0.8), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    pl.rotation.x = -Math.PI / 2; pl.position.y = 0.102; g.add(pl);
  }
  for (let i = 1; i < raw.length - 1; i++) {
    const j = group(raw[i][0], FLOOR, raw[i][1]);
    mesh(new THREE.CylinderGeometry(W / 2 + 0.06, W / 2 + 0.06, 0.13, 24), mat(C.rail), 0, 0.065, 0, j);
    mesh(new THREE.CylinderGeometry(W / 2 - 0.04, W / 2 - 0.04, 0.14, 24), mat(C.belt), 0, 0.075, 0, j);
  }
}

const P_SLOT_OUT: [number, number] = [-6.15, 0];
const path0 = new Path([P_SLOT_OUT, [0, 0]], BELT_TOP + 0.03);
const pathA = new Path([[0, 0.55], [2.1, 0.55], [2.1, 3.0], [3.35, 3.0]], BELT_TOP + 0.03);
const pathB = new Path([[0, -0.55], [2.9, -0.55], [2.9, -3.2], [4.55, -3.2]], BELT_TOP + 0.03);
belt([P_SLOT_OUT, [-0.7, 0]]);
belt([[0.7, 0.55], [2.1, 0.55], [2.1, 3.0], [3.3, 3.0]]);
belt([[0.7, -0.55], [2.9, -0.55], [2.9, -3.2], [4.4, -3.2]]);

// ---------- machines ----------
// Coin Slot = lemonade stand (faces -x, toward the queue)
const STAND = V(-7, FLOOR, 0);
const stand = springy(group(STAND.x, STAND.y, STAND.z));
{
  rbox(1.5, 0.95, 2.0, C.slot, 0, 0, 0, stand, 0.16);
  rbox(1.56, 0.12, 2.06, '#f2b81c', 0, 0.95, 0, stand, 0.05);
  for (let k = 0; k < 4; k++) rbox(0.05, 0.6, 0.05, '#ffffff', -0.55 + (k % 2) * 1.1, 1.05, (k < 2 ? -1 : 1) * 0.88, stand, 0.02);
  const aw = group(0, 1.62, 0, stand); aw.rotation.z = 0.22;
  for (let k = 0; k < 6; k++) rbox(1.7, 0.09, 0.38, k % 2 ? C.awningB : C.awningA, 0, 0, -0.95 + k * 0.38, aw, 0.04);
  // slot mouth on the customer side
  rbox(0.1, 0.34, 0.8, '#3a2c10', -0.76, 0.38, 0, stand, 0.04);
  rbox(0.06, 0.07, 0.56, '#111', -0.81, 0.52, 0, stand, 0.02);
  // pitcher + lemons
  mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.42, 16), mat('#fff3a6', { transparent: true, opacity: 0.85, roughness: 0.2 }), 0.2, 1.28, 0.45, stand);
  for (const [x, z] of [[0.15, -0.3], [0.32, -0.45], [0.05, -0.55]]) mesh(new THREE.SphereGeometry(0.11, 12, 10), mat('#ffe14d'), x, 1.17, z, stand).scale.set(1, 0.85, 1.25);
  // sign
  const signTex = canvasTex(512, 128, c => {
    c.fillStyle = '#fff6ec'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#e8456f'; c.font = '700 74px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('LEMONADE', 256, 70);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.9 }));
  const sg = group(0, 2.1, 0.15, stand); sg.rotation.y = 0.42;
  rbox(1.86, 0.52, 0.08, '#e8456f', 0, -0.26, -0.05, sg, 0.03);
  sign.position.set(0, 0, 0.0); sg.add(sign); sign.castShadow = true;
}
// Splitter
const SPLIT = V(0, FLOOR, 0);
const splitter = springy(group(SPLIT.x, SPLIT.y, SPLIT.z));
const needle = new THREE.Group();
{
  rbox(1.5, 0.78, 2.1, C.split, 0, 0, 0, splitter, 0.2);
  rbox(1.56, 0.1, 2.16, '#23a99c', 0, 0, 0, splitter, 0.05);
  for (const z of [0.55, -0.55]) rbox(0.12, 0.3, 0.6, '#16443f', 0.72, 0.12, z, splitter, 0.04);
  rbox(0.12, 0.3, 0.6, '#16443f', -0.72, 0.12, 0, splitter, 0.04);
  const pie = canvasTex(256, 256, c => {
    c.fillStyle = '#e9fffb'; c.beginPath(); c.arc(128, 128, 126, 0, 7); c.fill();
    c.fillStyle = '#ffc53a'; c.beginPath(); c.moveTo(128, 128); c.arc(128, 128, 112, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.7); c.fill();
    c.fillStyle = '#8b5cf6'; c.beginPath(); c.moveTo(128, 128); c.arc(128, 128, 112, -Math.PI / 2 + Math.PI * 2 * 0.7, Math.PI * 1.5); c.fill();
    c.fillStyle = '#e9fffb'; c.beginPath(); c.arc(128, 128, 54, 0, 7); c.fill();
    c.fillStyle = '#1d2433'; c.font = '700 44px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('70', 128, 132);
  });
  const dial = mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.12, 40), [mat('#e9fffb'), new THREE.MeshStandardMaterial({ map: pie, roughness: 0.6 }), mat('#e9fffb')] as unknown as THREE.Material, 0, 0.84, 0, splitter);
  dial.rotation.y = Math.PI / 2;
  needle.position.set(0, 0.92, 0); splitter.add(needle);
  rbox(0.07, 0.07, 0.5, '#1d2433', 0, 0, 0.22, needle, 0.03);
  mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 16), mat('#1d2433'), 0, 0.03, 0, needle);
}
let needleTarget = 0;
// Vault: a glass-walled bin where coins visibly stack
const VAULT = V(4.35, FLOOR, 3.0);
const vault = springy(group(VAULT.x, VAULT.y, VAULT.z));
const VB = 0.34; // base height
{
  rbox(2.2, VB, 2.2, C.vault, 0, 0, 0, vault, 0.14);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rbox(0.24, 1.55, 0.24, C.vaultDark, x * 0.98, VB - 0.02, z * 0.98, vault, 0.08);
  for (const s of [-1, 1]) { rbox(2.2, 0.14, 0.2, C.vaultDark, 0, VB + 1.45, s * 0.98, vault, 0.06); rbox(0.2, 0.14, 2.2, C.vaultDark, s * 0.98, VB + 1.45, 0, vault, 0.06); }
  const glass = new THREE.MeshStandardMaterial({ color: '#dff4ff', transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.1, depthWrite: false });
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.42), glass); a.position.set(0, VB + 0.72, s * 0.99); vault.add(a);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.42), glass); b.position.set(s * 0.99, VB + 0.72, 0); b.rotation.y = Math.PI / 2; vault.add(b);
  }
  // round door emblem facing the camera side
  const dm = mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 20), mat('#d9d3ff', { metalness: 0.4, roughness: 0.3 }), 0.5, VB / 2, 1.11, vault);
  dm.castShadow = false;
}
// Portal (NEAR side) and exit portal (ETH side): a well with a swirling disc
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
  return { g, sm, top: V(x, FLOOR + 0.35, z) };
}
const PORTAL = portal(5.65, -3.2, C.portal, C.portalDark, '#5b3bd6', '#4fd1ff');
const EXIT = portal(13.9, -6.4, C.eth, C.ethDark, '#3949c9', '#9fb0ff');

// ---------- decor ----------
function tree(x: number, z: number, kind: number, s = 1) {
  const g = group(x, -0.0, z); g.scale.setScalar(s);
  rbox(0.14, 0.4, 0.14, '#8a5a3c', 0, 0, 0, g, 0.04);
  if (kind === 0) { const c = mesh(new THREE.ConeGeometry(0.42, 1.0, 7), mat('#3fae6a', { flatShading: true }), 0, 0.85, 0, g); c.rotation.y = rnd(); }
  else {
    mesh(new THREE.IcosahedronGeometry(0.48, 1), mat(kind === 2 ? '#5bbf5f' : '#6fcf6a', { flatShading: true }), 0, 0.72, 0, g);
    if (kind === 2) for (let k = 0; k < 5; k++) { const a = k * 1.3; mesh(new THREE.SphereGeometry(0.08, 8, 6), mat('#ffe14d'), Math.cos(a) * 0.38, 0.6 + (k % 3) * 0.13, Math.sin(a) * 0.38, g); }
  }
}
for (const [x, z, k, s] of [[-12, 6, 0, 1.1], [-11.2, 6.4, 1, 1], [-12.2, 4.6, 2, 1], [-4, 6.4, 2, 0.9], [-2.6, 6.5, 1, 0.8], [7.6, 6.2, 0, 1.1], [8, 4.8, 1, 0.9], [6.4, 6.5, 2, 0.85], [-6, -6.6, 0, 1], [-4.5, -6.5, 1, 0.9], [1, -6.5, 0, 1.2], [2.4, -6.4, 2, 0.9], [8, -1, 0, 1], [8.1, 0.8, 1, 0.8], [-12.1, 1.8, 2, 0.9]] as const) tree(x, z, k, s);
// town (where customers live)
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
// ETH island: supplier hut and crystals
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

// ---------- coins (instanced) ----------
const coinGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.06, 22);
const coinMat = new THREE.MeshStandardMaterial({ color: C.coin, metalness: 0.55, roughness: 0.3, emissive: '#5a3500', emissiveIntensity: 0.25 });
const MAX_COINS = 260;
const coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, MAX_COINS); coinMesh.castShadow = true; coinMesh.frustumCulled = false; scene.add(coinMesh);
type Coin = { st: 'belt0' | 'A' | 'B' | 'hop' | 'fall' | 'toss'; d: number; t: number; dur: number; from: V3; to: V3; pos: V3; spin: number; flip: number; s: number; order: Order; dest: 'A' | 'B'; slot: number };
type Order = { id: number; sim: SimOrder; vaultIn: number; portalIn: number };
const coins: Coin[] = [];
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = V(), tmpV = V();

// vault stack (static instanced coins)
const STACK_COLS = 9, STACK_LEVELS = 18, STACK_MAX = STACK_COLS * STACK_LEVELS;
const stackMesh = new THREE.InstancedMesh(coinGeo, coinMat, STACK_MAX); stackMesh.castShadow = true; stackMesh.frustumCulled = false; stackMesh.count = 0; scene.add(stackMesh);
let stackCount = 0, stackReserved = 0, gulpT = -1;
function stackPos(k: number, out: V3) {
  const col = k % STACK_COLS, lvl = Math.floor(k / STACK_COLS);
  const cx = (col % 3) - 1, cz = Math.floor(col / 3) - 1;
  const j = Math.sin(k * 12.9898) * 0.03;
  return out.set(VAULT.x + cx * 0.52 + j, VAULT.y + VB + 0.03 + lvl * 0.062, VAULT.z + cz * 0.52 - j);
}
function setStackMatrix(k: number) {
  stackPos(k, tmpV); tmpQ.setFromEuler(tmpE.set(0, k * 0.7, 0)); tmpM.compose(tmpV, tmpQ, tmpS.set(1, 1, 1)); stackMesh.setMatrixAt(k, tmpM);
}

// gems on the ETH side
const gemGeo = new THREE.OctahedronGeometry(0.2, 0);
const gemMat = new THREE.MeshStandardMaterial({ color: '#8d9bff', metalness: 0.35, roughness: 0.18, flatShading: true, emissive: '#2e3bc4', emissiveIntensity: 0.35 });
const GEM_MAX = 24;
const gemPile = new THREE.InstancedMesh(gemGeo, gemMat, GEM_MAX); gemPile.castShadow = true; gemPile.frustumCulled = false; gemPile.count = 0; scene.add(gemPile);
let gemCount = 0;
type Gem = { t: number; m: THREE.Mesh; slot: number };
const flyingGems: Gem[] = [];
function gemSlot(k: number, out: V3) { const c = k % 12, l = Math.floor(k / 12); return out.set(PILE.x - 0.55 + (c % 4) * 0.37 + l * 0.18, PILE.y + 0.32 + l * 0.3, PILE.z - 0.37 + Math.floor(c / 4) * 0.37); }

// ---------- particles ----------
const MAX_P = 420;
const pMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: '#ffffff' }), MAX_P);
pMesh.frustumCulled = false; pMesh.count = 0; scene.add(pMesh);
for (let i = 0; i < MAX_P; i++) pMesh.setColorAt(i, new THREE.Color('#fff'));
type Part = { p: V3; v: V3; life: number; max: number; c: THREE.Color; s: number; g: number };
const parts: Part[] = [];
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
const orbCore = mesh(new THREE.OctahedronGeometry(0.2, 0), gemMat); orbCore.visible = false;
type Jump = { t: number; order: Order; popped: boolean };
const rings: { m: THREE.Mesh; t: number; max: number }[] = [];
function shock(at: V3, color: string, max = 3.2) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 48), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.copy(at); scene.add(m); rings.push({ m, t: 0, max });
}
let jump: Jump | null = null;

// ---------- tags & floaters ----------
const tagLayer = document.getElementById('tags')!;
type Tag = { el: HTMLElement; at: V3; dy: number };
const tags: Tag[] = [];
function tag(html: string, at: V3, cls = '', dy = 0) { const el = document.createElement('div'); el.className = 'tag ' + cls; el.innerHTML = html; tagLayer.appendChild(el); const t = { el, at, dy }; tags.push(t); return t; }
const vaultTag = tag('Vault<small>reserve</small><b>0.00 NEAR</b>', V(VAULT.x, 0, VAULT.z + 1.5), 'near');
tag('Coin Slot<b>0.10 NEAR</b>', V(STAND.x + 0.3, 0, STAND.z + 1.55));
tag('Splitter<b>70 / 30</b>', V(SPLIT.x + 0.2, 0, SPLIT.z + 1.5));
tag('Portal<small>→ Sepolia</small>', V(PORTAL.top.x + 0.4, 0, PORTAL.top.z + 1.45));
const supTag = tag('Supplier<b>0.0000 ETH</b>', V(HUT.x - 0.8, 0, HUT.z + 1.9), 'eth');
const nearTag = tag('NEAR island', V(-4, WATER_Y, 9.4), 'island');
const ethTag = tag('Ethereum island', V(ETH_ISLE.cx + 1, WATER_Y, ETH_ISLE.cz + ETH_ISLE.hz + 2.0), 'island');
type Floater = { el: HTMLElement; at: V3; t: number };
const floaters: Floater[] = [];
function floater(html: string, at: V3, cls: string) { const el = document.createElement('div'); el.className = 'floater ' + cls; el.innerHTML = html; tagLayer.appendChild(el); floaters.push({ el, at: at.clone(), t: 0 }); }

// ---------- audio (synth, no assets) ----------
let ac: AudioContext | null = null, muted = true;
const muteBtn = document.getElementById('mute')!;
muteBtn.onclick = () => { muted = !muted; if (!ac) ac = new AudioContext(); muteBtn.textContent = muted ? '🔇' : '🔊'; };
function blip(freq: number, dur = 0.08, type: OscillatorType = 'sine', vol = 0.06, slide = 0) {
  if (muted || !ac || fastForward) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
}

// ---------- customers ----------
const QUEUE: [number, number][] = [[-8.35, 0], [-9.2, 0.15], [-10.0, -0.25], [-10.55, -0.95], [-10.8, -1.85], [-10.6, -2.75]];
const SPAWN = V(-10.35, 0, -4.9);
const EXIT_PATH: [number, number][] = [[-8.35, 0], [-8.55, 1.35], [-9.4, 2.7], [-10.6, 3.7], [-11.6, 4.3]];
type Cust = { c: ReturnType<typeof character>; st: 'queue' | 'pay' | 'leave' | 'gone'; q: number; t: number; phase: number; exitI: number; pop: number };
const custs: Cust[] = [];
let lastSpawn = -9;
function spawnCustomer() {
  const c = character(SHIRT[Math.floor(rnd() * SHIRT.length)], SKIN[Math.floor(rnd() * SKIN.length)]);
  c.root.position.copy(SPAWN); c.root.position.y = 0; c.root.userData.s = 1.35;
  custs.push({ c, st: 'queue', q: custs.filter(k => k.st === 'queue' || k.st === 'pay').length, t: 0, phase: rnd() * 6, exitI: 1, pop: 0 });
}
function walkTo(cu: Cust, x: number, z: number, dt: number, speed = 1.7) {
  const p = cu.c.root.position, dx = x - p.x, dz = z - p.z, dist = Math.hypot(dx, dz);
  if (dist < 0.03) { cu.c.body.position.y = lerp(cu.c.body.position.y, 0, 0.3); cu.c.body.scale.set(1, 1, 1); return true; }
  const step = Math.min(dist, speed * dt); p.x += (dx / dist) * step; p.z += (dz / dist) * step;
  cu.c.root.rotation.y = Math.atan2(dx, dz);
  cu.phase += dt * 11; const h = Math.abs(Math.sin(cu.phase));
  cu.c.body.position.y = h * 0.13; cu.c.body.scale.set(1 + (1 - h) * 0.08, 1 - (1 - h) * 0.12, 1 + (1 - h) * 0.08);
  return false;
}
function groundY(x: number, z: number) { return Math.abs(x + 0.5) < 7.9 && Math.abs(z) < 4.7 ? FLOOR : 0; }

// ---------- game state ----------
let simT = 0, orderSeq = 0, standBusy = 0, served = 0, won = false;
let totalIn = 0n, totalKept = 0n, totalWei = 0n, vaultShown = 0n, weiShown = 0n;
const emitQ: { order: Order; dest: 'A' | 'B'; at: number }[] = [];
let engineOK = false;

function startOrder() {
  const sim = simulateOrder();
  const order: Order = { id: ++orderSeq, sim, vaultIn: 0, portalIn: 0 };
  totalIn += BigInt(PRICE); totalKept += sim.vaultYocto; totalWei += sim.wei; served++;
  // interleave coins by the engine's split (largest deficit first): 7 A + 3 B -> A A B A A B A A B A
  const n = sim.vaultCoins + sim.portalCoins; let a = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const wantA = ((i + 1) * sim.vaultCoins) / n - a, wantB = ((i + 1) * sim.portalCoins) / n - b;
    const dest: 'A' | 'B' = wantA >= wantB && a < sim.vaultCoins ? 'A' : b < sim.portalCoins ? 'B' : 'A';
    dest === 'A' ? a++ : b++;
    emitQ.push({ order, dest, at: simT + 0.12 + i * 0.16 });
  }
  kick(stand, 5); burst(V(STAND.x - 0.8, FLOOR + 0.6, STAND.z), 10, '#ffe14d', 1.6, 2.2);
  blip(880, 0.09, 'triangle', 0.07, 1.5);
  updateHud();
}
function newCoin(st: Coin['st'], order: Order, dest: 'A' | 'B'): Coin | null {
  if (coins.length >= MAX_COINS) return null;
  const c: Coin = { st, d: 0, t: 0, dur: 0, from: V(), to: V(), pos: V(), spin: rnd() * 6, flip: 0, s: 1, order, dest, slot: -1 };
  coins.push(c); return c;
}

function startJump(order: Order) {
  if (jump && !jump.popped) popGem(jump);
  jump = { t: 0, order, popped: false };
  kick(PORTAL.g, 6); blip(220, 0.5, 'sawtooth', 0.025, 3.2); shock(PORTAL.top.clone().setY(FLOOR + 0.4), '#c9b8ff', 2.4);
  if (punchEnabled && !fastForward && simT - lastPunch > 13) { lastPunch = simT; punchT = 0; }
}
function popGem(j: Jump) {
  j.popped = true; kick(EXIT.g, 7); shake = 0.22; shock(EXIT.top.clone().setY(FLOOR + 0.4), '#ffffff', 3.6); shock(EXIT.top.clone().setY(FLOOR + 0.4), '#9fb0ff', 2.6);
  const m = new THREE.Mesh(gemGeo, gemMat); m.castShadow = true; scene.add(m);
  const slot = gemCount % GEM_MAX; flyingGems.push({ t: 0, m, slot });
  burst(EXIT.top.clone().setY(FLOOR + 0.6), 26, '#b9c3ff', 3, 4); burst(EXIT.top.clone().setY(FLOOR + 0.6), 10, '#ffffff', 2, 5);
  floater(`+${fmtEth(j.order.sim.wei)} ETH<span class="sim">SIMULATED</span>`, EXIT.top.clone().add(V(0, 1.6, 0)), 'eth');
  weiShown += j.order.sim.wei; supplierHop = 1;
  blip(660, 0.14, 'sine', 0.08, 2.0);
  updateHud();
}

// ---------- camera framing ----------
let portrait = false;
const base = { target: V(), zoom: 1 };
let shot: { target: V3; zoom: number } | null = null;
let punchEnabled = true, punchT = -1, lastPunch = -99, shake = 0;
const camDir = V();
function layoutCamera() {
  const w = innerWidth, h = innerHeight; portrait = h > w * 1.15;
  renderer.setSize(w, h, false);
  const az = portrait ? THREE.MathUtils.degToRad(110) : THREE.MathUtils.degToRad(24);
  const el = portrait ? THREE.MathUtils.degToRad(52) : THREE.MathUtils.degToRad(40);
  camDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  // content to frame
  const pts = portrait
    ? [V(-10.6, 0, -2.4), V(-9.2, 0, 0.6), V(-7, 2.6, 0), V(4.4, 0, 4.3), V(5.6, 0, -4.6), V(13, 0, -9.6), V(19, 0, -8.5), V(17.5, 2.2, -8.7), V(16.5, 0, -3.8)]
    : [V(-11.2, 0, -4.6), V(-11.0, 0, 2.2), V(5.4, 0, 4.6), V(7.2, 0, -4.8), V(18.6, 0, -10.0), V(19.4, 0, -4.4), V(-7, 2.6, 0), V(17.5, 2.2, -9)];
  const c0 = V(2, 0, -1);
  camera.position.copy(c0).addScaledVector(camDir, 80); camera.up.set(0, 1, 0); camera.lookAt(c0); camera.updateMatrixWorld();
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const p of pts) { const v = p.clone().applyMatrix4(camera.matrixWorldInverse); minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }
  const mt = portrait ? 205 : 30, mb = portrait ? 132 : 84, ml = portrait ? 4 : 20, mr = portrait ? 4 : 20;
  const s = Math.max((maxX - minX) / (w - ml - mr), (maxY - minY) / (h - mt - mb));
  const cx = (minX + maxX) / 2 - ((ml - mr) / 2) * s, cy = (minY + maxY) / 2 - ((mb - mt) / 2) * s;
  const right = V(1, 0, 0).applyQuaternion(camera.quaternion), up = V(0, 1, 0).applyQuaternion(camera.quaternion);
  base.target.copy(c0).addScaledVector(right, cx).addScaledVector(up, cy);
  base.zoom = 1;
  camera.left = (-w / 2) * s; camera.right = (w / 2) * s; camera.top = (h / 2) * s; camera.bottom = (-h / 2) * s;
  camera.updateProjectionMatrix();
  nearTag.el.style.display = ethTag.el.style.display = portrait ? 'none' : '';
}
const camTarget = V(); let camZoom = 1;
function applyCamera(dt: number) {
  let tgt = base.target, zm = base.zoom;
  if (shot) { tgt = shot.target; zm = shot.zoom; }
  else if (punchT >= 0) {
    const k = punchT < 0.7 ? easeInOut(punchT / 0.7) : punchT < 2.4 ? 1 : 1 - easeInOut(Math.min(1, (punchT - 2.4) / 0.9));
    const focus = V(10.2, 0.4, -4.9);
    tgt = base.target.clone().lerp(focus, k * 0.85); zm = lerp(base.zoom, base.zoom * (portrait ? 1.55 : 1.75), k);
  }
  camTarget.copy(tgt); camZoom = zm;
  const sx = (rnd() - 0.5) * shake, sy = (rnd() - 0.5) * shake; shake *= Math.pow(0.02, dt);
  camera.position.copy(camTarget).addScaledVector(camDir, 80); camera.lookAt(camTarget);
  camera.position.x += sx; camera.position.y += sy;
  camera.zoom = camZoom; camera.updateProjectionMatrix();
}

// ---------- HUD ----------
const $ = (id: string) => document.getElementById(id)!;
const dots = $('custDots'); for (let i = 0; i < 10; i++) dots.appendChild(document.createElement('i'));
function toast(text: string, cls = '', ms = 2600) { const t = $('toast'); t.textContent = text; t.className = 'toast show ' + cls; clearTimeout((t as any)._h); (t as any)._h = setTimeout(() => (t.className = 'toast'), ms); }
function updateHud() {
  const pct = totalIn ? Number((totalKept * 1000n) / totalIn) / 10 : 0;
  $('keptPct').textContent = pct.toFixed(0) + '%';
  ($('keptFill') as HTMLElement).style.width = pct + '%';
  [...dots.children].forEach((d, i) => d.classList.toggle('on', i < served));
  vaultTag.el.querySelector('b')!.textContent = fmtNear(vaultShown) + ' NEAR';
  supTag.el.querySelector('b')!.textContent = fmtEth(weiShown) + ' ETH';
  if (!won && served >= 10 && !fastForward) { won = true; toast('★ Goal met: the stand keeps 70% of every sale', 'win', 3200); }
}
$('run').onclick = () => toast('Concept build: not wired. In the game this publishes the machine and sends 1 real testnet order.', '', 3800);

// ---------- simulation step ----------
let fastForward = false;
function step(dt: number) {
  simT += dt;
  waterU.t.value = simT; for (const m of swirlMats) m.uniforms.t.value = simT;
  for (const t of beltTextures) t.offset.x -= (BELT_SPEED / 0.6) * dt;

  // customers
  const inLine = custs.filter(k => k.st === 'queue' || k.st === 'pay');
  if (inLine.length < QUEUE.length && simT - lastSpawn > 0.9) { spawnCustomer(); lastSpawn = simT; }
  inLine.forEach((k, i) => (k.q = i));
  for (const cu of custs) {
    if (cu.pop < 1) { cu.pop = Math.min(1, cu.pop + dt * 3); cu.c.root.scale.setScalar(easeOut(cu.pop) * 1.35); }
    if (cu.st === 'queue') {
      const [qx, qz] = QUEUE[Math.min(cu.q, QUEUE.length - 1)];
      const there = walkTo(cu, qx, qz, dt);
      if (there && cu.q === 0 && engineOK && simT > standBusy) {
        cu.st = 'pay'; cu.t = 0; cu.c.root.rotation.y = Math.PI / 2;
        const c = newCoin('toss', null as any, 'A');
        if (c) { c.from.set(qx + 0.15, 0.55, qz); c.to.set(STAND.x - 0.8, FLOOR + 0.52, STAND.z); c.dur = 0.36; c.s = 1.25; }
      }
    } else if (cu.st === 'pay') {
      cu.t += dt; cu.c.body.rotation.x = Math.sin(Math.min(1, cu.t / 0.3) * Math.PI) * 0.25;
      if (cu.t > 0.55) { cu.st = 'leave'; cu.c.cup.visible = true; cu.c.body.rotation.x = 0; standBusy = simT + 1.25; }
    } else if (cu.st === 'leave') {
      const [x, z] = EXIT_PATH[cu.exitI];
      if (walkTo(cu, x, z, dt, 1.5)) { cu.exitI++; if (cu.exitI >= EXIT_PATH.length) { cu.st = 'gone'; burst(cu.c.root.position.clone().setY(0.4), 8, '#ffffff', 1.2, 1.5, 4); scene.remove(cu.c.root); } }
    }
    if (cu.st !== 'gone') cu.c.root.position.y = groundY(cu.c.root.position.x, cu.c.root.position.z);
  }
  for (let i = custs.length - 1; i >= 0; i--) if (custs[i].st === 'gone') custs.splice(i, 1);
  // supplier celebrates
  if (supplierHop > 0) { supplierHop = Math.max(0, supplierHop - dt * 1.6); const h = Math.abs(Math.sin((1 - supplierHop) * Math.PI * 2)); supplier.body.position.y = h * 0.35 * supplierHop; }

  // emit coins from the stand
  while (emitQ.length && emitQ[0].at <= simT) {
    const e = emitQ.shift()!; const c = newCoin('belt0', e.order, e.dest);
    if (c) { c.d = 0; blip(1320, 0.03, 'square', 0.012); }
  }

  // coins
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.spin += dt * 2;
    if (c.st === 'toss') {
      c.t += dt; const k = clamp01(c.t / c.dur);
      c.pos.lerpVectors(c.from, c.to, k); c.pos.y += Math.sin(k * Math.PI) * 0.9; c.flip = k * Math.PI * 3;
      if (k >= 1) { coins.splice(i, 1); startOrder(); continue; }
    } else if (c.st === 'belt0') {
      c.d += BELT_SPEED * dt; path0.at(c.d, c.pos);
      if (c.d >= path0.length) {
        c.st = c.dest; c.d = 0; needleTarget = c.dest === 'A' ? 0.5 : Math.PI - 0.5; kick(splitter, 1.6);
        burst(V(SPLIT.x + 0.8, FLOOR + 0.5, c.dest === 'A' ? 0.55 : -0.55), 3, c.dest === 'A' ? '#ffd76a' : '#b9a8ff', 1.2, 1.6);
        blip(c.dest === 'A' ? 520 : 390, 0.05, 'triangle', 0.03);
      }
    } else if (c.st === 'A' || c.st === 'B') {
      const p = c.st === 'A' ? pathA : pathB; c.d += BELT_SPEED * dt; p.at(c.d, c.pos);
      if (c.d >= p.length) {
        if (c.st === 'A') {
          c.st = 'hop'; c.t = 0; c.dur = 0.42; c.from.copy(c.pos);
          c.slot = stackReserved++; if (c.slot >= STACK_MAX) { c.slot = STACK_MAX - 1; }
          stackPos(c.slot, c.to);
        } else { c.st = 'fall'; c.t = 0; c.from.copy(c.pos); }
      }
    } else if (c.st === 'hop') {
      c.t += dt; const k = clamp01(c.t / c.dur);
      c.pos.lerpVectors(c.from, c.to, k); c.pos.y += Math.sin(k * Math.PI) * 1.1; c.flip = k * Math.PI * 2;
      if (k >= 1) {
        coins.splice(i, 1);
        if (gulpT < 0 && c.slot < STACK_MAX) { setStackMatrix(c.slot); stackCount = Math.max(stackCount, c.slot + 1); stackMesh.count = stackCount; stackMesh.instanceMatrix.needsUpdate = true; }
        kick(vault, 0.9); burst(c.to.clone().add(V(0, 0.05, 0)), 3, '#ffe27a', 0.9, 1.2);
        blip(1560 + (c.slot % 5) * 90, 0.06, 'sine', 0.035);
        c.order.vaultIn++; vaultShown += 10n ** 22n;
        if (c.order.vaultIn === c.order.sim.vaultCoins) { floater(`+${fmtNear(c.order.sim.vaultYocto)} NEAR`, V(VAULT.x, VAULT.y + 2.4, VAULT.z), 'near'); }
        if (stackReserved >= STACK_MAX - 6 && gulpT < 0) gulpT = 0;
        updateHud();
        continue;
      }
    } else if (c.st === 'fall') {
      c.t += dt; const k = clamp01(c.t / 0.5);
      const a = k * Math.PI * 3, r = (1 - k) * 0.95;
      c.pos.set(PORTAL.top.x - Math.cos(a) * r, lerp(c.from.y, PORTAL.top.y - 0.25, easeOut(k)) + Math.sin(k * Math.PI) * 0.35, PORTAL.top.z + Math.sin(a) * r * 0.9);
      c.s = 1 - k * k; c.flip = k * 6;
      if (k >= 1) {
        coins.splice(i, 1); kick(PORTAL.g, 1.4); burst(PORTAL.top.clone().add(V(0, 0.1, 0)), 4, '#c9b8ff', 1, 1.4);
        blip(300 - c.order.portalIn * 40, 0.12, 'sine', 0.04, 0.6);
        c.order.portalIn++;
        if (c.order.portalIn === c.order.sim.portalCoins) startJump(c.order);
        continue;
      }
    }
  }

  // vault gulp: stack is full -> coins drop into the vault floor (counter unchanged)
  if (gulpT >= 0) {
    gulpT += dt; const k = clamp01(gulpT / 0.6);
    for (let j = 0; j < stackCount; j++) { stackPos(j, tmpV); tmpV.y = lerp(tmpV.y, VAULT.y + VB, k); tmpM.compose(tmpV, tmpQ.setFromEuler(tmpE.set(0, j * 0.7, 0)), tmpS.setScalar(1 - k)); stackMesh.setMatrixAt(j, tmpM); }
    stackMesh.instanceMatrix.needsUpdate = true;
    if (k >= 1) { gulpT = -1; stackCount = 0; stackMesh.count = 0; stackReserved = coins.filter(c => c.st === 'hop').length; kick(vault, 6); }
  }

  // splitter needle
  needle.rotation.y = lerp(needle.rotation.y, needleTarget, 1 - Math.pow(0.0005, dt));

  // jump: charge -> beam -> pop -> fade
  for (const m of swirlMats) m.uniforms.glow.value *= Math.pow(0.1, dt);
  if (jump) {
    jump.t += dt; const t = jump.t;
    PORTAL.sm.uniforms.glow.value = Math.max(PORTAL.sm.uniforms.glow.value, t < 0.3 ? t / 0.3 : 0);
    const fly = clamp01((t - 0.25) / 0.85);
    beamU.head.value = t < 0.25 ? -1 : easeInOut(fly) * 1.02;
    beamU.fade.value = t < 1.1 ? 1 : Math.max(0, 1 - (t - 1.1) / 0.6);
    orb.visible = orbCore.visible = t >= 0.25 && t < 1.1;
    if (orb.visible) { beamCurve.getPoint(easeInOut(fly), orb.position); orbCore.position.copy(orb.position); orbCore.rotation.y += dt * 8; if (rnd() < 0.6) burst(orb.position, 1, '#d8d0ff', 0.4, 0.2, 1, 0.8); }
    if (t >= 1.1 && !jump.popped) { EXIT.sm.uniforms.glow.value = 1; popGem(jump); }
    if (t > 1.8) { jump = null; beamU.fade.value = 0; }
  }
  // gems: pop up out of the exit portal, bounce onto the supplier's pallet
  for (let i = flyingGems.length - 1; i >= 0; i--) {
    const g = flyingGems[i]; g.t += dt;
    gemSlot(g.slot, tmpV); const t = g.t;
    if (t < 0.35) { const k = t / 0.35; g.m.position.set(EXIT.top.x, EXIT.top.y + easeOut(k) * 1.7, EXIT.top.z); g.m.scale.set(0.6 + k * 0.6, 0.6 + k * 1.0, 0.6 + k * 0.6); }
    else { const k = clamp01((t - 0.35) / 0.55); g.m.position.set(lerp(EXIT.top.x, tmpV.x, k), lerp(EXIT.top.y + 1.7, tmpV.y, k * k) + Math.sin(k * Math.PI) * 0.7, lerp(EXIT.top.z, tmpV.z, k)); g.m.scale.setScalar(1.15 - 0.15 * k); }
    g.m.rotation.y += dt * 9;
    if (t > 0.9) {
      scene.remove(g.m); flyingGems.splice(i, 1);
      if (gemCount >= GEM_MAX) { gemCount = 0; }
      tmpM.compose(tmpV, tmpQ.setFromEuler(tmpE.set(0, g.slot, 0)), tmpS.set(1, 1.5, 1)); gemPile.setMatrixAt(g.slot, tmpM);
      gemCount++; gemPile.count = Math.max(gemPile.count, gemCount); gemPile.instanceMatrix.needsUpdate = true;
      burst(tmpV, 6, '#c9d0ff', 1, 1.5); blip(990, 0.08, 'triangle', 0.04);
    }
  }

  // particles
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life += dt; if (p.life > p.max) { parts.splice(i, 1); continue; } p.v.y -= p.g * dt; p.p.addScaledVector(p.v, dt); }
  for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.t += dt; f.at.y += dt * 0.9; if (f.t > 1.6) { f.el.remove(); floaters.splice(i, 1); } }
  stepSprings(dt);
  if (punchT >= 0) { punchT += dt; if (punchT > 3.3) punchT = -1; }
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; const k = clamp01(r.t / 0.6); r.m.scale.setScalar(1 + easeOut(k) * r.max); (r.m.material as THREE.MeshBasicMaterial).opacity = 1 - k; if (k >= 1) { scene.remove(r.m); rings.splice(i, 1); } }
  if (punchT >= 0 || shot) {} // camera handled in applyCamera
}

// ---------- draw ----------
const proj = V();
function draw(dt: number) {
  applyCamera(dt);
  let n = 0;
  for (const c of coins) {
    tmpQ.setFromEuler(tmpE.set(c.flip, c.spin, 0)); tmpM.compose(c.pos, tmpQ, tmpS.setScalar(c.s)); coinMesh.setMatrixAt(n++, tmpM);
  }
  coinMesh.count = n; coinMesh.instanceMatrix.needsUpdate = true;
  n = 0;
  for (const p of parts) {
    const k = 1 - p.life / p.max; tmpM.compose(p.p, tmpQ.setFromEuler(tmpE.set(p.life * 6, p.life * 4, 0)), tmpS.setScalar(p.s * k)); pMesh.setMatrixAt(n, tmpM); pMesh.setColorAt(n, p.c); n++;
  }
  pMesh.count = n; pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
  renderer.render(scene, camera);
  const W = innerWidth, H = innerHeight;
  for (const t of tags) {
    proj.copy(t.at).project(camera); const hw = (t.el.offsetWidth || 80) / 2 + 6;
    t.el.style.left = Math.min(W - hw, Math.max(hw, ((proj.x + 1) / 2) * W)) + 'px'; t.el.style.top = ((1 - proj.y) / 2) * H + t.dy + 'px';
  }
  for (const f of floaters) { proj.copy(f.at).project(camera); f.el.style.left = ((proj.x + 1) / 2) * W + 'px'; f.el.style.top = ((1 - proj.y) / 2) * H + 'px'; f.el.style.opacity = String(f.t < 1.1 ? 1 : 1 - (f.t - 1.1) / 0.5); }
}

// ---------- loop & test hooks ----------
let paused = false, last = performance.now();
const frameTimes: number[] = [];
function frame(now: number) {
  const dt = Math.min(1 / 30, (now - last) / 1000); frameTimes.push(now - last); if (frameTimes.length > 240) frameTimes.shift(); last = now;
  if (!paused) step(dt);
  draw(paused ? 0 : dt);
  requestAnimationFrame(frame);
}
addEventListener('resize', layoutCamera);

const SHOTS: Record<string, () => { target: V3; zoom: number }> = {
  splitter: () => ({ target: V(0.9, 0.3, 0.6), zoom: portrait ? 2.2 : 2.6 }),
  portal: () => ({ target: V(9.8, 0.6, -4.9), zoom: portrait ? 1.5 : 1.75 }),
};
(window as any).__ww = {
  advance(sec: number, quiet = true) { fastForward = quiet; const n = Math.round(sec * 60); for (let i = 0; i < n; i++) step(1 / 60); fastForward = false; draw(0); },
  pause(p: boolean) { paused = p; last = performance.now(); },
  setShot(name: string | null) { shot = name ? SHOTS[name]() : null; draw(0); },
  punch(on: boolean) { punchEnabled = on; },
  info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
  state: () => ({ simT, served, jump: jump ? jump.t : -1, coins: coins.length, stack: stackCount, gems: gemCount, kept: totalKept.toString(), wei: totalWei.toString() }),
  fps: () => { const a = frameTimes.slice(-120); return a.length ? 1000 / (a.reduce((x, y) => x + y, 0) / a.length) : 0; },
};

// Merge every static, opaque mesh by material: ~450 draw calls -> ~70.
function mergeStatic() {
  const dyn = new Set<THREE.Object3D>([...springs, needle, orbCore, beam, water, supplier.root]);
  scene.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>(); const kill: THREE.Mesh[] = [];
  scene.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as any).isInstancedMesh || Array.isArray(m.material) || !(m.material instanceof THREE.MeshStandardMaterial) || m.material.transparent) return;
    for (let a: THREE.Object3D | null = m; a; a = a.parent) if (dyn.has(a)) return;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(m.matrixWorld);
    if (!buckets.has(m.material)) buckets.set(m.material, []); buckets.get(m.material)!.push(g); kill.push(m);
  });
  for (const m of kill) m.parent!.remove(m);
  for (const [material, geos] of buckets) { const merged = mergeGeometries(geos, false); if (!merged) continue; const mm = new THREE.Mesh(merged, material); mm.castShadow = mm.receiveShadow = true; scene.add(mm); }
}

async function boot() {
  mergeStatic();
  layoutCamera();
  await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]);
  redraws.forEach(f => f());
  try { await bootEngine(); engineOK = true; }
  catch (e) { toast('Engine failed to load: ' + (e as Error).message, '', 10000); }
  updateHud();
  (window as any).__ww.ready = true;
  requestAnimationFrame(t => { last = t; frame(t); });
}
boot();
