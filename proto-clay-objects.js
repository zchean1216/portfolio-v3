// Clay world for the hero prototypes: Saturn, moon, satellite, three asteroids, and the studio light.
// Shared by proto-clay-test.html (look test) and proto-hero-v2.html (scroll journey).
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const coarse = matchMedia('(pointer: coarse)').matches;

// ---------- Noise (seeded, so the clay looks the same every load) ----------
const hash = (x, y, z) => {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const f = t => t * t * (3 - 2 * t), u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), L(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
           L(L(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), L(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v), w);
}
function fbm(x, y, z, oct = 4) {
  let s = 0, a = .5;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x, y, z); x *= 2.03; y *= 2.03; z *= 2.03; a *= .5; }
  return s;
}
let seed = 7;
const rnd = () => (seed = Math.imul(seed ^ (seed >>> 15), 2246822519) + 1 | 0, ((seed >>> 0) % 100000) / 100000);

// ---------- Clay material ----------
// Fully matte, colour in the vertices, plus a thin rust rim on the edge facing the key light.
const SRGB = hex => new THREE.Color(hex);
export const keyView = { value: new THREE.Vector3() };   // key light direction in view space, set each frame
const GRAIN = `
  float gh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float gn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(mix(gh(i), gh(i + vec3(1, 0, 0)), f.x), mix(gh(i + vec3(0, 1, 0)), gh(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(gh(i + vec3(0, 0, 1)), gh(i + vec3(1, 0, 1)), f.x), mix(gh(i + vec3(0, 1, 1)), gh(i + 1.), f.x), f.y), f.z); }`;
// Every material in this world goes through patch(): optional clay grain (a bump from fine noise),
// optional thin rust rim on the edge facing the key light, and a dissolve that crumbles the object into dust.
// rough: a real clay surface (mottled colour, pores, grain at three sizes), sized to the object so it reads the same
// on a pebble or a planet. paint: the same grain pressed into a flat painted image (the astronaut).
// Saturn's shell is clay tiles; uSpread pulls them apart (the intro's exploded drawing).
export const tileU = { uT: { value: 0 }, uSpread: { value: 0 } };
const LIFT = `uniform float uT, uSpread; attribute vec4 aTile;
  vec3 lift(){ return aTile.xyz * uSpread * (.35 + aTile.w * .9); }\n`;
export function patch(m, { grain = 0, rim = false, rough = false, paint = false, tile = false } = {}) {
  const dissolve = m.userData.dissolve = { value: 0 }, uGrain = { value: grain };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uKeyV: keyView, uDissolve: dissolve, uGrain }, tile ? tileU : {});
    sh.vertexShader = 'varying vec3 vObj; varying float vScale;\n' + (tile ? LIFT : '') + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vObj = position;${tile ? ' transformed += lift();' : ''}
      #ifdef USE_INSTANCING
        vScale = length((modelMatrix * instanceMatrix)[0].xyz);
      #else
        vScale = length(modelMatrix[0].xyz);
      #endif`);
    let f = sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      float dN = gn(vObj * 9.) * .7 + gn(vObj * 34.) * .3;
      if (dN < uDissolve * 1.1) discard;`)
      .replace('#include <opaque_fragment>', `outgoingLight += vec3(.85, .4, .22) * smoothstep(uDissolve * 1.1 + .08, uDissolve * 1.1, dN) * step(.001, uDissolve) * .9;
      #include <opaque_fragment>`);
    if (rough) f = f.replace('#include <color_fragment>', `#include <color_fragment>
      float rM = gn(vObj * 6.) * .5 + gn(vObj * 19.) * .3 + gn(vObj * 57.) * .2;   // lighter and darker patches
      float rP = smoothstep(.74, .88, gn(vObj * 42. + 3.));                         // pores and little pits
      diffuseColor.rgb *= (.84 + rM * .3) * (1. - rP * .25);`);
    if (paint) f = f.replace('#include <map_fragment>', `#include <map_fragment>
      { float pH = gn(vObj * 13.) * .6 + gn(vObj * 30.) * .4;                     // grain lit from the upper left
        diffuseColor.rgb *= 1. + (dFdy(pH) - dFdx(pH)) * 1.4 + (pH - .5) * .08; }`);
    if (grain) f = f.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { // grain as a bump: perturb the normal by the screen-space slope of a fine noise height
        float gH = ${rough ? '((gn(vObj * 14.) * .3 + gn(vObj * 45.) * .4 + gn(vObj * 110.) * .3) - rP * .5) * uGrain * vScale'
                           : '(gn(vObj * 45.) * .7 + gn(vObj * 110.) * .3) * uGrain'};
        vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition), r1 = cross(dpy, normal), r2 = cross(normal, dpx);
        float det = dot(dpx, r1);
        normal = normalize(abs(det) * normal - sign(det) * (dFdx(gH) * r1 + dFdy(gH) * r2));
      }`);
    if (rim) f = f.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float fres = pow(1. - saturate(dot(normal, normalize(vViewPosition))), 5.);
      totalEmissiveRadiance += vec3(.8, .34, .2) * fres * smoothstep(.05, .6, dot(normal, uKeyV)) * 1.4;`);
    sh.fragmentShader = 'uniform vec3 uKeyV; uniform float uDissolve, uGrain; varying vec3 vObj; varying float vScale;\n' + GRAIN + '\n' + f;
  };
  m.customProgramCacheKey = () => `clay-${!!grain}-${rim}-${rough}-${paint}-${tile}`;
  return m;
}
const SURFACE = .0016;   // grain depth for every rough surface
export const clay = (grain = 0, colour, rough = true) => patch(new THREE.MeshStandardMaterial({ vertexColors: !colour, color: colour || 0xffffff, roughness: 1, metalness: 0 }),
  { grain: rough ? SURFACE : grain, rim: true, rough });
// 0 = whole, 1 = gone. Shadows switch off once it starts to crumble.
export function setDissolve(obj, v) {
  obj.visible = v < .999;
  obj.traverse(o => { if (o.material?.userData.dissolve) { o.material.userData.dissolve.value = v; o.castShadow = v < .01; } });
}

// A sphere pushed in and out by `shape(p) -> [radius, colour]`, built on an icosphere so it has no seam.
function claySphere(detail, shape, grain, rough = true) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail));
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).normalize();
    const [r, c] = shape(p);
    pos.setXYZ(i, p.x * r, p.y * r, p.z * r);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, clay(grain, undefined, rough));
  m.castShadow = m.receiveShadow = true;
  return m;
}
const tmpC = new THREE.Color();
const mixC = (a, b, t) => tmpC.copy(a).lerp(b, Math.min(Math.max(t, 0), 1)).clone();
const ss = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

// Palette sampled from the clay renders.
const CREAM = SRGB('#ead9c3'), SAND = SRGB('#c8ad92'), DUST = SRGB('#b39a84'), RUST = SRGB('#b4634a');
const detail = coarse ? 48 : 96;

// ---------- Saturn ----------
// Soft, wavy cloud belts: latitude warped by slow noise and a gentle wave, colours blended, no hard edges.
const BANDS = [SAND, CREAM, DUST, CREAM, SAND, RUST, CREAM, SAND, CREAM, DUST, SAND, CREAM, SAND, CREAM, SAND];
export const planet = claySphere(detail, p => {
  const lon = Math.atan2(p.z, p.x);
  const y = p.y + (fbm(p.x * 2.5, p.y * 2.5, p.z * 2.5, 3) - .5) * .09 + Math.sin(lon * 3 + p.y * 6) * .02;
  const f = Math.min(Math.max((y * .5 + .5) * (BANDS.length - 1), 0), BANDS.length - 1.001), i = Math.floor(f);
  const c = mixC(mixC(BANDS[i], BANDS[i + 1], ss(.3, .7, f - i)), DUST, (fbm(p.x * 5, p.y * 5, p.z * 5, 3) - .4) * .2);
  return [1 + (fbm(p.x * 2.2 + 9, p.y * 2.2, p.z * 2.2) - .5) * .02, c];
}, .0009, false);   // Saturn keeps its own grain

// Rings: one thin disc painted with many fine cream, sand and rust bands, see-through towards its edges.
const R0 = 1.3, R1 = 2.35;
function ringTexture() {
  const w = 1024, h = 128, cv = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const cx = cv.getContext('2d'), img = cx.createImageData(w, h);
  const pal = ['#ead9c3', '#d8c2a8', '#c8ad92', '#b4634a'].map(x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)));
  for (let x = 0; x < w; x++) {
    const u = x / (w - 1);
    const tone = fbm(u * 38, .5, .5, 3), rust = ss(.66, .72, fbm(u * 21 + 7, 3, 3, 2));
    const base = pal[Math.min(2, Math.floor(tone * 3.6))].map((v, k) => v + (pal[3][k] - v) * rust * .8);
    let a = .8 + .2 * fbm(u * 40, 9, 9, 2);                          // gentle density changes, nothing finer than the screen can hold
    a *= 1 - .92 * ss(.04, 0, Math.abs(u - .6));                     // Cassini gap
    a *= ss(0, .06, u) * (.45 + .55 * ss(0, .3, u)) * (1 - .55 * ss(.7, .97, u)) * ss(1, .975, u);  // thin at both edges, clean rim
    for (let y = 0; y < h; y++) {
      const ang = y / h * Math.PI * 2, j = (y * w + x) * 4;
      const k = 1 + (fbm(Math.cos(ang) * 3, Math.sin(ang) * 3, u * 30, 2) - .5) * .14;   // clumps, so the turning reads
      img.data[j] = base[0] * k; img.data[j + 1] = base[1] * k; img.data[j + 2] = base[2] * k; img.data[j + 3] = a * 235;
    }
  }
  cx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const ringGeo = new THREE.RingGeometry(R0, R1, coarse ? 160 : 320, 1), ruv = ringGeo.attributes.uv, rp = ringGeo.attributes.position;
for (let i = 0; i < rp.count; i++) {
  let a = Math.atan2(rp.getY(i), rp.getX(i)); if (a < 0) a += Math.PI * 2;
  ruv.setXY(i, (Math.hypot(rp.getX(i), rp.getY(i)) - R0) / (R1 - R0), a / (Math.PI * 2));
}
const ringMap = ringTexture();
const ring = new THREE.Mesh(ringGeo, patch(new THREE.MeshStandardMaterial({ map: ringMap, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1 })));
ring.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: ringMap, alphaTest: .35 });
ring.rotation.x = -Math.PI / 2; ring.castShadow = ring.receiveShadow = true;
export const rings = new THREE.Group(); rings.add(ring);
export const saturn = new THREE.Group(), tilt = new THREE.Group();
tilt.add(planet, rings); tilt.rotation.set(.42, 0, -.34);
saturn.add(tilt);

// Cut the planet into tiles (Voronoi cells around evenly spread seeds), each with side walls so it reads as a thick
// block when it lifts. Under the shell sits a dark clay core. The tile outlines double as the intro's blueprint.
export const TILES = coarse ? 110 : 150;
const tileSeeds = Array.from({ length: TILES }, (_, i) => {   // Fibonacci sphere, jittered
  const y = 1 - (i + .5) / TILES * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996 + rnd() * .5;
  return new THREE.Vector3(Math.cos(a) * r, y + (rnd() - .5) * .04, Math.sin(a) * r).normalize();
});
const tileRand = tileSeeds.map(() => rnd());
const WALL = .9, tileLineGeo = new THREE.BufferGeometry();
{
  const src = planet.geometry, idx = src.index.array, P = src.attributes.position, C = src.attributes.color;
  const nTri = idx.length / 3, cell = new Int16Array(nTri), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < nTri; t++) {
    a.fromBufferAttribute(P, idx[t * 3]).add(b.fromBufferAttribute(P, idx[t * 3 + 1])).add(b.fromBufferAttribute(P, idx[t * 3 + 2]));
    let best = -9, bi = 0;
    for (let k = 0; k < TILES; k++) { const d = a.dot(tileSeeds[k]); if (d > best) { best = d; bi = k; } }
    cell[t] = bi;
  }
  const pos = [], nor = [], col = [], til = [], line = [], lineTile = [], edges = new Map();
  const N = src.attributes.normal, n = new THREE.Vector3();
  const tileOf = k => [tileSeeds[k].x, tileSeeds[k].y, tileSeeds[k].z, tileRand[k]];
  for (let t = 0; t < nTri; t++) {
    for (let j = 0; j < 3; j++) {
      const v = idx[t * 3 + j];
      pos.push(P.getX(v), P.getY(v), P.getZ(v)); nor.push(N.getX(v), N.getY(v), N.getZ(v)); col.push(C.getX(v), C.getY(v), C.getZ(v));
      til.push(...tileOf(cell[t]));
      const w = idx[t * 3 + (j + 1) % 3], key = Math.min(v, w) * 1e6 + Math.max(v, w), o = edges.get(key);
      if (o === undefined) edges.set(key, t); else if (cell[o] !== cell[t]) edges.set(key, [v, w, cell[o], cell[t]]);
    }
  }
  const wallC = DUST.clone().multiplyScalar(.62);
  for (const e of edges.values()) {
    if (!Array.isArray(e)) continue;
    const [v, w, ...cells] = e;
    a.fromBufferAttribute(P, v); b.fromBufferAttribute(P, w);
    for (const k of cells) {
      // wall quad from the outer edge down to the core, wound to face away from its own tile
      n.crossVectors(c.subVectors(b, a), a);
      const flip = n.dot(c.copy(tileSeeds[k]).sub(a)) > 0;
      // shade the wall as if it were smooth: facing straight away from its tile's centre, not along the jagged edge
      n.copy(a).sub(c.copy(tileSeeds[k]).multiplyScalar(a.dot(tileSeeds[k]))).normalize();
      const [p0, p1] = flip ? [b, a] : [a, b], q0 = p0.clone().multiplyScalar(WALL), q1 = p1.clone().multiplyScalar(WALL);
      for (const q of [p0, q0, p1, p1, q0, q1]) { pos.push(q.x, q.y, q.z); nor.push(n.x, n.y, n.z); col.push(wallC.r, wallC.g, wallC.b); til.push(...tileOf(k)); }
      line.push(a.x, a.y, a.z, b.x, b.y, b.z); lineTile.push(...tileOf(k), ...tileOf(k));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aTile', new THREE.Float32BufferAttribute(til, 4));
  planet.geometry.dispose(); planet.geometry = g;
  planet.material = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), { grain: .0009, rim: true, tile: true });
  tileLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(line, 3));
  tileLineGeo.setAttribute('aTile', new THREE.Float32BufferAttribute(lineTile, 4));
}
// The blueprint: tile outlines plus the ring edges, which spread apart along the axis like an exploded drawing.
export const blueU = { uDraw: { value: 0 }, uAlpha: { value: 0 }, uScan: { value: -1 }, uPx: { value: 1 } };
const BLUE = `uniform float uDraw, uAlpha, uScan; varying float vT;
  void main(){ if (vT > uDraw) discard; float head = smoothstep(uDraw - .06, uDraw, vT), scan = exp(-pow((vT - uScan) * 14., 2.));
    gl_FragColor = vec4((mix(vec3(.62, .8, 1.), vec3(1.), head) + scan * vec3(.6, .85, 1.) * 1.6) * uAlpha * .85, 1.); }`;   // blueprint white-blue, a scan sweeps across once
export const tileLines = new THREE.LineSegments(tileLineGeo, new THREE.ShaderMaterial({
  uniforms: { ...tileU, ...blueU }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: LIFT + `varying float vT;
    void main(){ vT = .5 - position.y * .25 + aTile.w * .2;   // drawn top to bottom
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position * 1.002 + lift(), 1.); }`,
  fragmentShader: BLUE
}));
export const RING_PARTS = [['C ring', 1.32, 1.55, -.55], ['B ring', 1.55, 1.92, 0], ['A ring', 1.98, 2.33, .55]];
export const ringLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
  uniforms: { ...tileU, ...blueU }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `uniform float uSpread; attribute float aOff; varying float vT;
    void main(){ vT = .25 + length(position.xz) * .2;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position + vec3(0, aOff * uSpread, 0), 1.); }`,
  fragmentShader: BLUE
}));
{
  const pos = [], off = [];
  for (const [, r0, r1, o] of RING_PARTS) for (const r of [r0, r1]) for (let i = 0; i < 160; i++) {
    const u0 = i / 160 * Math.PI * 2, u1 = (i + 1) / 160 * Math.PI * 2;
    pos.push(Math.cos(u0) * r, 0, Math.sin(u0) * r, Math.cos(u1) * r, 0, Math.sin(u1) * r); off.push(o, o);
  }
  pos.push(0, -2.2, 0, 0, 2.2, 0); off.push(0, 0);   // the axis
  ringLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  ringLines.geometry.setAttribute('aOff', new THREE.Float32BufferAttribute(off, 1));
}
export const core = claySphere(coarse ? 24 : 40, () => [WALL + .005, SAND.clone().multiplyScalar(.42)]);
// Chalk sparks: a few points along the outlines lift off, drift outward and fade, over and over.
export const tileSparks = new THREE.Points(tileLineGeo, new THREE.ShaderMaterial({
  uniforms: { ...tileU, ...blueU }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: LIFT + `uniform float uPx; varying float vA;
    float h(float n){ return fract(sin(n) * 43758.5453); }
    void main(){ float id = dot(position, vec3(129.898, 782.33, 377.19));
      if (h(id) < .88) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; vA = 0.; return; }
      float ph = fract(uT * .3 + h(id + 4.1));
      vec3 p = position + lift() + aTile.xyz * ph * .3 + (vec3(h(id + 1.), h(id + 2.), h(id + 3.)) - .5) * ph * .25;
      vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
      gl_PointSize = min(uPx * .03 * (1. - ph * .6) / -mv.z, 8.);
      vA = sin(ph * 3.1416) * (.5 + h(id + 5.) * .5); }`,
  fragmentShader: `uniform float uAlpha; varying float vA;
    void main(){ float d = length(gl_PointCoord - .5) * 2.; gl_FragColor = vec4(vec3(.75, .9, 1.) * (1. - smoothstep(.1, 1., d)) * vA * uAlpha, 1.); }`
}));
tileSparks.frustumCulled = false;
planet.add(tileLines, tileSparks); tilt.add(core, ringLines);
// Saturn's atmosphere: a thin warm haze around the edge, brightest on the side the key light falls on.
export const halo = new THREE.Mesh(new THREE.SphereGeometry(1.085, 96, 64), new THREE.ShaderMaterial({
  uniforms: { uO: { value: 1 }, uKeyV: keyView }, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uO; uniform vec3 uKeyV; varying vec3 vN, vV;
    void main(){ float g = pow(smoothstep(0., .42, abs(dot(vN, vV))), 2.2), lit = .2 + .8 * smoothstep(-.35, .65, dot(vN, uKeyV));
      gl_FragColor = vec4(vec3(1., .74, .52) * g * lit * uO * .14, 1.); }`   // barely there, by request
}));
tilt.add(halo);


// ---------- Moon ----------
// A clean round ball with six clear, shallow, rounded craters, like thumbprints in clay.
// Shallow enough that the outline stays round; floors a shade darker and rims a shade lighter so they read.
const craters = [[-.35, .38, .86, .26], [.42, .22, .88, .2], [.02, -.38, .92, .22], [-.62, -.3, .73, .17], [.56, -.5, .66, .15], [.18, .72, .67, .16]]
  .map(([x, y, z, r]) => ({ d: new THREE.Vector3(x, y, z).normalize(), r, h: r * .14 }));
export const moon = claySphere(detail, p => {
  let h = 0, floor = 0, lip = 0;
  for (const c of craters) {
    const t = Math.acos(Math.min(1, p.dot(c.d))) / c.r;
    if (t > 2) continue;
    if (t < 1) { h -= c.h * (.5 + .5 * Math.cos(Math.PI * t)); floor = Math.max(floor, ss(1, .4, t)); }
    const l = Math.exp(-(((t - 1.05) / .3) ** 2)); h += c.h * .35 * l; lip = Math.max(lip, l);
  }
  const mare = ss(.45, .65, fbm(p.x * 1.4 + 4, p.y * 1.4, p.z * 1.4));
  const c = mixC(mixC(CREAM, SAND, mare * .6 + (fbm(p.x * 4, p.y * 4, p.z * 4, 3) - .4) * .2), DUST, floor * .45);
  return [1 + h, mixC(c, CREAM, lip * .35)];
}, .0007);

// ---------- Satellite ----------
// Same build as the Gemini one: cream capsule body, rust end cap, rust arms, sand panels, rust dish with struts.
const part = (geo, colour, grain = .0002) => { const m = new THREE.Mesh(geo, clay(grain, colour)); m.castShadow = m.receiveShadow = true; return m; };
function pill(r, len, round, seg = 64) {                 // a rounded cylinder along Y
  const pts = [new THREE.Vector2(0, -len / 2)], n = 8;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i / n * Math.PI / 2; pts.push(new THREE.Vector2(r - round + Math.cos(a) * round, -len / 2 + round + Math.sin(a) * round)); }
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI / 2; pts.push(new THREE.Vector2(r - round + Math.cos(a) * round, len / 2 - round + Math.sin(a) * round)); }
  pts.push(new THREE.Vector2(0, len / 2));
  return new THREE.LatheGeometry(pts, seg);
}
function dishGeo(R = .78, depth = .36, th = .07) {         // a thick bowl with a rounded lip, opening up +Y
  const pts = [], n = 24, y = x => depth * (x / R) ** 2;
  for (let i = 0; i <= n; i++) { const x = i / n * R; pts.push(new THREE.Vector2(x, y(x) - th)); }
  for (let i = 1; i < 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI; pts.push(new THREE.Vector2(R + Math.cos(a) * th / 2, y(R) - th / 2 + Math.sin(a) * th / 2)); }
  for (let i = n; i >= 0; i--) { const x = i / n * R; pts.push(new THREE.Vector2(x, y(x))); }
  return new THREE.LatheGeometry(pts, 64);
}
export const satellite = new THREE.Group(), sat = new THREE.Group();
const along = m => (m.rotation.x = Math.PI / 2, m);       // lathe Y axis -> body axis Z
sat.add(along(part(pill(.62, 1.5, .3), CREAM)));
const cap = along(part(pill(.5, .5, .18), RUST)); cap.position.z = -.82; sat.add(cap);
const neck = along(part(pill(.24, .5, .08), RUST)); neck.position.z = .85; sat.add(neck);
const dish = along(part(dishGeo(), RUST)); dish.position.z = 1.05; dish.receiveShadow = false; sat.add(dish);   // self-shadow speckles the thin bowl
const tip = new THREE.Vector3(0, 0, 1.55);
for (let i = 0; i < 3; i++) {
  const a = i / 3 * Math.PI * 2 + .5, from = new THREE.Vector3(Math.cos(a) * .5, Math.sin(a) * .5, 1.05 + .36 * (.5 / .78) ** 2);
  const len = from.distanceTo(tip), st = part(new THREE.CylinderGeometry(.035, .035, len, 12), RUST);
  st.position.copy(from).lerp(tip, .5);
  st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(from).normalize());
  sat.add(st);
}
const knob = part(new THREE.SphereGeometry(.09, 24, 16), CREAM); knob.position.copy(tip); sat.add(knob);
for (const sx of [-1, 1]) {
  const arm = part(new RoundedBoxGeometry(.42, .26, .36, 3, .08), RUST); arm.position.x = sx * .78; sat.add(arm);
  const panel = part(new RoundedBoxGeometry(1.35, .17, 1.05, 4, .07), SAND); panel.position.x = sx * 1.6; sat.add(panel);
}
sat.rotation.set(.65, -.75, .15);                          // three-quarter view from slightly above, like the render
satellite.add(sat);

// ---------- Asteroids ----------
// Three clay rocks after the Gemini ones: a chipped block, a long potato, a round lumpy one.
const dents = (p, list) => {                              // soft craters and pits: [height, floor shade]
  let h = 0, floor = 0;
  for (const c of list) {
    const t = Math.acos(Math.min(1, p.dot(c.d))) / c.r;
    if (t > 2) continue;
    if (t < 1) { h -= c.h * (.5 + .5 * Math.cos(Math.PI * t)); floor = Math.max(floor, ss(1, .3, t)); }
    h += c.h * .3 * Math.exp(-(((t - 1.05) / .3) ** 2));
  }
  return [h, floor];
};
const randDir = () => new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
const pits = (n, r0, r1, depth) => Array.from({ length: n }, () => { const r = r0 + rnd() * (r1 - r0); return { d: randDir(), r, h: r * depth }; });
const smin = (a, b, k) => -k * Math.log(Math.exp(-a / k) + Math.exp(-b / k));
const rockColour = (p, floor) => mixC(mixC(CREAM, SAND, (fbm(p.x * 3, p.y * 3, p.z * 3, 3) - .45) * .4), DUST, floor * .5);
const rock = (shape, scale, grain) => { const m = claySphere(64, shape, grain); m.scale.set(...scale); return m; };

const cuts = [[1, .2, .1, .78], [-.3, 1, .2, .7], [.2, -.4, 1, .74], [-1, -.3, .4, .8], [.3, .1, -1, .82], [.1, -1, -.2, .68], [.7, .7, .5, .82], [-.6, .5, -.6, .84]]
  .map(([x, y, z, d]) => ({ n: new THREE.Vector3(x, y, z).normalize(), d }));
const blockDents = [...pits(10, .04, .07, .35), { d: new THREE.Vector3(.3, .6, .75).normalize(), r: .2, h: .045 }, { d: new THREE.Vector3(.9, .1, .4).normalize(), r: .17, h: .04 }];
export const rockA = rock(p => {                                  // flat chipped faces with soft edges
  let r = 1.05 + (fbm(p.x * 2.5, p.y * 2.5, p.z * 2.5) - .5) * .18;
  for (const c of cuts) { const k = p.dot(c.n); if (k > .05) r = smin(r, (c.d + (fbm(p.x * 4 + c.d, p.y * 4, p.z * 4, 2) - .5) * .08) / k, .045); }
  const [h, floor] = dents(p, blockDents);
  return [r + h, rockColour(p, floor)];
}, [1.25, .95, 1], .0006);
const potatoDents = [...pits(16, .03, .055, .4), { d: new THREE.Vector3(.35, .45, .82).normalize(), r: .26, h: .09 }];
export const rockB = rock(p => {                                  // long potato with a slight waist and one deep crater
  const r = 1 + (fbm(p.x * 2, p.y * 2, p.z * 2) - .5) * .12 - .07 * Math.exp(-((p.x / .35) ** 2));
  const [h, floor] = dents(p, potatoDents);
  return [r + h, rockColour(p, floor)];
}, [1.6, .82, .88], .0005);
const roundDents = [{ d: new THREE.Vector3(-.4, -.1, .9).normalize(), r: .3, h: .06 }, { d: new THREE.Vector3(.45, .45, .77).normalize(), r: .24, h: .05 }];
export const rockC = rock(p => {                                  // round, lumpy, smooth, two soft craters
  const r = 1 + (fbm(p.x * 1.8, p.y * 1.8, p.z * 1.8) - .5) * .18;
  const [h, floor] = dents(p, roundDents);
  return [r + h, rockColour(p, floor)];
}, [1, 1, 1], .0003);
rockB.rotation.z = -.9;
export const rocks = new THREE.Group(); rocks.add(rockA, rockB, rockC);

// Signal rings: three thin rings that pulse out of the dish (animated by the page).
export const signals = new THREE.Group();
for (let i = 0; i < 3; i++) signals.add(new THREE.Mesh(new THREE.RingGeometry(.92, 1, 96),
  new THREE.MeshBasicMaterial({ color: '#e9a37e', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })));
signals.position.z = 1.45; sat.add(signals);

// ---------- Rocket ----------
// Cream body with a round nose (the rust nose cone was turned down for the loader rocket), rust fins and band,
// a sand porthole, a dusty nozzle. Points up +Y; the page flies it and lights the flame.
export const rocket = new THREE.Group();
{
  const pts = [new THREE.Vector2(0, -.95), new THREE.Vector2(.26, -.95), new THREE.Vector2(.33, -.86), new THREE.Vector2(.36, -.6), new THREE.Vector2(.37, .15)];
  for (let i = 1; i <= 16; i++) { const k = i / 16; pts.push(new THREE.Vector2(.37 * Math.sqrt(1 - k * k) ** 1.15, .15 + k * 1.05)); }
  rocket.add(part(new THREE.LatheGeometry(pts, 64), CREAM));
  const band = part(new THREE.CylinderGeometry(.378, .378, .1, 64), RUST); band.position.y = .02; rocket.add(band);
  const port = part(new THREE.SphereGeometry(.15, 32, 16), SAND); port.scale.z = .4; port.position.set(0, .42, .33); port.rotation.x = -.18; rocket.add(port);
  const rim = part(new THREE.TorusGeometry(.16, .035, 12, 48), RUST); rim.position.copy(port.position); rim.rotation.x = -.18; rocket.add(rim);
  const noz = part(new THREE.LatheGeometry([new THREE.Vector2(.15, 0), new THREE.Vector2(.19, -.12), new THREE.Vector2(.25, -.26), new THREE.Vector2(.21, -.27), new THREE.Vector2(.12, -.05)], 48), DUST);
  noz.position.y = -.93; rocket.add(noz);
  for (let i = 0; i < 3; i++) {
    const fin = part(new RoundedBoxGeometry(.07, .55, .36, 3, .03), RUST), a = i / 3 * Math.PI * 2;
    fin.position.set(Math.sin(a) * .42, -.66, Math.cos(a) * .42); fin.rotation.y = a; rocket.add(fin);
  }
}

// ---------- Space station ----------
// A hub with a turning habitat wheel on spokes, a solar mast, and a docking port with a warm light.
export const station = new THREE.Group(), wheel = new THREE.Group();
{
  station.add(part(pill(.34, 1.5, .16), CREAM));
  for (const y of [-.55, .55]) { const b = part(new THREE.CylinderGeometry(.355, .355, .09, 48), RUST); b.position.y = y; station.add(b); }
  const ring = part(new THREE.TorusGeometry(1.35, .16, 24, 120), SAND); ring.rotation.x = Math.PI / 2; wheel.add(ring);
  for (let i = 0; i < 4; i++) {
    const s = part(new THREE.CylinderGeometry(.045, .045, 1.05, 12), RUST), a = i / 4 * Math.PI * 2;
    s.rotation.z = Math.PI / 2; s.rotation.y = a; s.position.set(Math.cos(a) * .82, 0, -Math.sin(a) * .82); wheel.add(s);
  }
  station.add(wheel);
  const mast = part(new THREE.CylinderGeometry(.05, .05, .9, 12), DUST); mast.position.y = 1.15; station.add(mast);
  for (const x of [-.75, .75]) { const p = part(new RoundedBoxGeometry(1.1, .05, .5, 2, .02), SAND); p.position.set(x, 1.5, 0); station.add(p); }
  const dock = part(pill(.18, .4, .06), RUST); dock.position.y = -.9; station.add(dock);
}
export const dockLight = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 8), new THREE.MeshBasicMaterial({ color: '#f6c45a', toneMapped: false }));
dockLight.position.y = -1.13; station.add(dockLight);

// ---------- Places: what each stop sits in ----------
// A huge clay world, only ever seen as a curved horizon: dusty plains and wide shallow craters.
const worldPits = pits(60, .02, .09, .12);
export const world = claySphere(coarse ? 40 : 72, p => {
  const [h, floor] = dents(p, worldPits), plain = ss(.4, .7, fbm(p.x * 2 + 3, p.y * 2, p.z * 2));
  return [1 + h, mixC(mixC(SAND, DUST, plain * .8), RUST, floor * .3).multiplyScalar(.62)];   // a shade darker, so it stays behind the stop
}, .0003);
world.castShadow = world.receiveShadow = false;
world.material.transparent = true;
// Its atmosphere: a soft glow hugging the limb, fading outwards.
export const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.08, 96, 64), new THREE.ShaderMaterial({
  uniforms: { uO: { value: 1 }, uC: { value: new THREE.Color('#9fd0c8') } },
  side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uO; uniform vec3 uC; varying vec3 vN, vV;
    void main(){ float g = pow(smoothstep(0., .37, abs(dot(vN, vV))), 2.); gl_FragColor = vec4(uC * g * uO * .55, 1.); }`
}));

// Fields of little clay stones (a planet's ring, an asteroid belt): three shapes, instanced.
// place() returns [position, size] for one stone.
export function stoneField(n, detail, place) {
  const mat = clay(.0004), field = new THREE.Group(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  for (let k = 0; k < 3; k++) {
    const pit = pits(4, .2, .35, .25);
    const geo = claySphere(detail, p => {
      const [h, floor] = dents(p, pit);
      return [1 + (fbm(p.x * 1.6 + k * 5, p.y * 1.6, p.z * 1.6) - .5) * .5 + h, rockColour(p, floor)];
    }).geometry.scale(.8 + rnd() * .6, .6 + rnd() * .4, .8 + rnd() * .4);
    const count = Math.ceil(n / 3), im = new THREE.InstancedMesh(geo, mat, count);
    for (let i = 0; i < count; i++) {
      const [pos, size] = place();
      im.setMatrixAt(i, m.compose(pos, q.setFromEuler(e.set(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3)), s.setScalar(size)));
    }
    im.computeBoundingSphere();
    field.add(im);
  }
  return field;
}

// ---------- Light: warm key from the upper left, orange rim from behind left, warm taupe fill and bounce ----------
export function addLights(scene) {
  const key = new THREE.DirectionalLight('#fff0dd', 3.6);
  key.position.set(-7, 6, 3); key.castShadow = true;
  key.shadow.mapSize.set(coarse ? 512 : 1024, coarse ? 512 : 1024); key.shadow.radius = 6; key.shadow.bias = -.0004; key.shadow.normalBias = .02;   // soft, wide penumbra
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 5, bottom: -5, near: .5, far: 30 });
  const rim = new THREE.DirectionalLight('#ff7a3c', 2.5);
  rim.position.set(-6, 1, -5);
  const fill = new THREE.HemisphereLight('#7a5e50', '#33241c', 1.1);
  const bounce = new THREE.DirectionalLight('#8a6656', .9);   // warm bounce into the shadow side
  bounce.position.set(6, -2, 4);
  scene.add(key, key.target, rim, rim.target, fill, bounce, bounce.target);
  return { key, rim, bounce };
}

// Real rings are made of ice chunks: a sprinkle of clay pebbles orbits within the painted bands.
export const pebbles = stoneField(coarse ? 450 : 1000, 1, () => {
  const a = rnd() * Math.PI * 2, r = R0 + .05 + rnd() * (R1 - R0 - .1);
  return [new THREE.Vector3(Math.cos(a) * r, (rnd() - .5) * .03, Math.sin(a) * r), .003 + rnd() ** 6 * .022];
});
rings.add(pebbles);
