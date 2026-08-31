/* ═══════════════════════════════════════════════
   A round brilliant, cut properly.

   57 facets in the real arrangement: table, 8 stars,
   8 kites, 16 upper girdle, the girdle band, 8 pavilion
   mains, 16 lower girdle halves. Flat shaded, refractive,
   lit by a studio environment built at runtime so nothing
   is fetched.
   ═══════════════════════════════════════════════ */

// three.js r170, vendored so the page fetches nothing from a CDN
import * as THREE from './vendor/three.module.js';

/* ── proportions, girdle radius = 1 ───────────────────── */
const RT = 0.560;   // table radius
const HC = 0.300;   // crown height
const RS = 0.790;   // star tip radius
const YS = 0.132;   // star tip height
const GT = 0.020;   // girdle half thickness
const HP = 0.870;   // pavilion depth
const LG = 0.760;   // how far the lower girdle facets reach toward the culet

const A = (i, half) => (i * 45 + (half ? 22.5 : 0)) * Math.PI / 180;
const P = (ang, r, y) => new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r);

function brilliantGeometry() {
  const T = [], S = [], Gm = [], Gh = [], GmB = [], GhB = [], L = [];
  for (let i = 0; i < 8; i++) {
    T.push(P(A(i, 0), RT, HC));                 // table corner
    S.push(P(A(i, 1), RS, YS));                 // star tip
    Gm.push(P(A(i, 0), 1, GT));                 // girdle, top edge, bezel side
    Gh.push(P(A(i, 1), 1, GT));                 // girdle, top edge, star side
    GmB.push(P(A(i, 0), 1, -GT));               // girdle, bottom edge
    GhB.push(P(A(i, 1), 1, -GT));
  }
  const culet = new THREE.Vector3(0, -HP, 0);
  for (let i = 0; i < 8; i++) {
    // tip where a pair of lower girdle facets meets, on the way to the culet
    L.push(GhB[i].clone().lerp(culet, LG));
  }

  const pos = [];
  const tri = (a, b, c) => { pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); };
  const fan = (pts) => { for (let i = 1; i < pts.length - 1; i++) tri(pts[0], pts[i], pts[i + 1]); };
  const n = (i) => (i + 1) % 8;
  const p = (i) => (i + 7) % 8;

  fan(T);                                                   // table
  for (let i = 0; i < 8; i++) {
    fan([T[i], T[n(i)], S[i]]);                             // star facet
    fan([T[i], S[i], Gm[i], S[p(i)]]);                      // kite / bezel
    fan([S[i], Gh[i], Gm[i]]);                              // upper girdle
    fan([S[i], Gm[n(i)], Gh[i]]);                           // upper girdle
    fan([Gm[i], Gh[i], GhB[i], GmB[i]]);                    // girdle band
    fan([Gh[i], Gm[n(i)], GmB[n(i)], GhB[i]]);              // girdle band
    fan([GmB[i], L[i], culet, L[p(i)]]);                    // pavilion main
    fan([GmB[i], GhB[i], L[i]]);                            // lower girdle half
    fan([GhB[i], GmB[n(i)], L[i]]);                         // lower girdle half
  }

  // Wind every triangle outwards. Deriving the winding by hand for 57 facets
  // is where this goes wrong, so test each face against an interior point and
  // flip the ones that face inward. The stone is convex, so this is exact.
  const mid = new THREE.Vector3(0, (HC - HP) / 2, 0);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (let i = 0; i < pos.length; i += 9) {
    a.set(pos[i], pos[i + 1], pos[i + 2]);
    b.set(pos[i + 3], pos[i + 4], pos[i + 5]);
    c.set(pos[i + 6], pos[i + 7], pos[i + 8]);
    nrm.copy(ab.subVectors(b, a)).cross(ac.subVectors(c, a));
    if (nrm.dot(ac.copy(a).sub(mid)) < 0) {
      pos[i + 3] = c.x; pos[i + 4] = c.y; pos[i + 5] = c.z;
      pos[i + 6] = b.x; pos[i + 7] = b.y; pos[i + 8] = b.z;
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();                                 // flat: every face is its own triangle set
  return g;
}

/* ── a studio, drawn into an equirectangular canvas ───── */
function studioEnv(renderer) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const x = c.getContext('2d');

  const sky = x.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0.00, '#f2f6fa');
  sky.addColorStop(0.24, '#8fa2b6');
  sky.addColorStop(0.40, '#3d4b5a');
  sky.addColorStop(0.58, '#141a21');
  sky.addColorStop(1.00, '#05070a');
  x.fillStyle = sky;
  x.fillRect(0, 0, 1024, 512);

  // dark vertical cards: negative fill, the way a gem is actually shot
  x.fillStyle = '#03050a';
  x.fillRect(400, 0, 150, 512);
  x.fillRect(900, 0, 124, 512);

  // key and fill panels: the hard edges are what become sparkle
  const panel = (cx, cy, w, h, v) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h));
    g.addColorStop(0, `rgba(255,255,255,${v})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(cx - w, cy - h, w * 2, h * 2);
  };
  x.fillStyle = '#ffffff';
  x.fillRect(96, 28, 232, 132);
  x.fillRect(620, 44, 176, 104);
  x.fillRect(300, 186, 78, 50);
  panel(212, 94, 250, 168, 1);
  panel(708, 96, 210, 148, 0.95);
  panel(140, 250, 190, 110, 0.34);

  // bounce below the horizon: the pavilion has to catch something
  x.fillStyle = 'rgba(214,226,240,0.85)';
  x.fillRect(150, 356, 210, 62);
  x.fillRect(700, 372, 150, 50);
  panel(255, 386, 230, 120, 0.42);
  panel(775, 396, 180, 100, 0.34);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}

/**
 * Mounts the stone. Returns null when WebGL is unavailable, so the caller
 * can fall back rather than showing an empty box.
 */
export function mountDiamond(canvas, opts = {}) {
  const reduced = opts.reduced === true;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: true, powerPreference: 'high-performance'
    });
  } catch (e) { return null; }
  if (!renderer || !renderer.getContext()) return null;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearAlpha(0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.34, 4.5);
  camera.lookAt(0, -0.16, 0);

  let env;
  try { env = studioEnv(renderer); scene.environment = env; }
  catch (e) { /* lights alone still render the stone */ }

  // On a white page a fully transmissive stone refracts white and disappears.
  // What reads as a diamond here is reflection: a hard, high contrast studio
  // so the facets alternate bright and dark, the way a stone is actually shot.
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.85,
    roughness: 0.02,
    transmission: 0,
    ior: 2.417,
    reflectivity: 1,
    envMapIntensity: 2.4,
    flatShading: true,
    side: THREE.FrontSide
  });


  const gem = new THREE.Mesh(brilliantGeometry(), material);
  gem.rotation.x = 0.30;
  scene.add(gem);

  // two hard speculars so the crown always catches something
  const k1 = new THREE.DirectionalLight(0xffffff, 2.4); k1.position.set(2.5, 3.4, 2.2);
  const k2 = new THREE.DirectionalLight(0xdce9f7, 1.3); k2.position.set(-3, 1.2, -2);
  scene.add(k1, k2);

  function size() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  size();

  let raf = 0, live = false, last = 0;
  function frame(now) {
    if (!live) return;
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0.016;
    last = now;
    gem.rotation.y += dt * 0.42;              // time based, so speed never tracks frame rate
    gem.rotation.x = 0.30 + Math.sin(now * 0.00035) * 0.045;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function start() { if (live) return; live = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { live = false; cancelAnimationFrame(raf); }

  if (reduced) { renderer.render(scene, camera); }
  else if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      es.forEach((e) => (e.isIntersecting ? start() : stop()));
    }, { threshold: 0.04 }).observe(canvas);
  } else { start(); }

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { size(); if (!live) renderer.render(scene, camera); }, 160);
  });

  return { start, stop, renderer };
}
