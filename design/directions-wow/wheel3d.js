// Колесо в настоящем 3D (three.js), версия 2: сплошная резина с прорезанными канавками, литой диск одним куском,
// студийный свет с софтбоксами, глянцевый пол. Анимация «переобувки»: детали собираются в колесо.
// mountWheel(canvas, { text, marks, accent, frozenT, reduced }) → { setMarks(text, marks), destroy() }
import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeIO = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const back = (x) => { x = clamp(x); const c = 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const span = (t, a, b) => clamp((t - a) / (b - a));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ── Студия: тёмный зал, большой софтбокс сверху, две вертикальные полосы по бокам, слабый контровой
function studioEnv(renderer) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x111114);
  const box = (w, h, x, y, z, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  box(9, 4, 0, 7, 1, 2.6);         // большой софтбокс сверху
  box(1.2, 8, -6, 1, 3, 3.4);     // длинная полоса слева-спереди
  box(1.0, 8, 6, 1, -2, 2.0);     // полоса справа-сзади (контровой)
  box(9, 4.5, 1.5, 3, 8, 1.5);    // большой мягкий спереди-сверху: лицо диска светится
  box(1.0, 6, 5, 0.5, 4, 1.4);    // узкая справа-спереди: блик на ободе
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0x050506 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -3; s.add(floor);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(s, 0.02).texture; pm.dispose();
  return env;
}

// ── Шина: сечение (r, y) от внутреннего борта через беговую дорожку к внешнему борту
function profilePoints() {
  const P = [];
  const side = (sgn) => { const a = []; for (let i = 0; i <= 26; i++) { const s = i / 26, r = 0.69 + 0.255 * s, y = sgn * (0.335 + 0.05 * Math.sin(Math.PI * Math.min(1, s * 1.12)) - 0.03 * s * s); a.push([r, y]); } return a; };
  const shoulder = (sgn, rev) => { const a = []; for (let i = 1; i <= 12; i++) { const k = i / 13, q = (k * Math.PI) / 2; a.push([0.945 + 0.055 * Math.sin(q), sgn * (0.305 - 0.045 * (1 - Math.cos(q)))]); } return rev ? a.reverse() : a; };
  P.push(...side(-1), ...shoulder(-1, false));
  for (let i = 0; i <= 60; i++) { const y = -0.26 + 0.52 * (i / 60); P.push([1.0 - 0.006 * Math.pow(Math.abs(y) / 0.26, 4), y]); }
  P.push(...shoulder(1, true), ...side(1).reverse());
  return P;
}
// Глубина канавок протектора в точке (угол a, координата поперёк y): продольные, косые «ёлочкой» и тонкие ламели
function grooveDepth(a, y) {
  const ay = Math.abs(y);
  if (ay > 0.27) return 0;
  let d = 0;
  for (const c of [0.085, 0.2]) d = Math.max(d, 0.03 * (1 - sstep(0.011, 0.016, Math.abs(ay - c))));
  const N = 46, ph = (a * N) / TAU + ay * 3.2 * (y > 0 ? 1 : 1);
  const fr = Math.abs(((ph % 1) + 1) % 1 - 0.5); // 0.5 у канавки
  if (ay > 0.095) d = Math.max(d, 0.026 * sstep(0.455, 0.47, fr) * sstep(0.27, 0.25, ay));
  const ph2 = (a * N * 2) / TAU + ay * 5.0 + 0.25, fr2 = Math.abs(((ph2 % 1) + 1) % 1 - 0.5);
  d = Math.max(d, 0.012 * sstep(0.475, 0.485, fr2) * (ay < 0.075 || (ay > 0.1 && ay < 0.19) ? 1 : 0));
  return d;
}
function tireGeometry(seg = 720) {
  const prof = profilePoints(), n = prof.length;
  const pos = new Float32Array((seg + 1) * n * 3), uv = new Float32Array((seg + 1) * n * 2);
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * TAU, ca = Math.cos(a), sa = Math.sin(a);
    for (let j = 0; j < n; j++) {
      let [r, y] = prof[j];
      if (r > 0.99) r -= grooveDepth(a, y);
      const k = (i * n + j) * 3;
      pos[k] = ca * r; pos[k + 1] = sa * r; pos[k + 2] = y;
      uv[(i * n + j) * 2] = i / seg; uv[(i * n + j) * 2 + 1] = j / (n - 1);
    }
  }
  const idx = [];
  for (let i = 0; i < seg; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j, b = (i + 1) * n + j; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  // какие v у передней боковины (y>0, r 0.74-0.92) — туда ляжет надпись
  let v0 = 1, v1 = 0; prof.forEach(([r, y], j) => { if (y > 0.05 && r > 0.74 && r < 0.92) { v0 = Math.min(v0, j / (n - 1)); v1 = Math.max(v1, j / (n - 1)); } });
  return { g, v0, v1 };
}
// Рельеф боковины: надпись, кольца, мелкая насечка у борта
function sideBump(text, marks, vA, vB) {
  const W = 4096, H = 1024, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  const row = (v) => (1 - v) * H;
  const yA = row(vA), yB = row(vB), top = Math.min(yA, yB), hgt = Math.abs(yB - yA), mid = top + hgt / 2;
  g.fillStyle = "#5a5a5a"; g.fillRect(0, top + hgt * 0.02, W, Math.max(2, hgt * 0.02)); g.fillRect(0, top + hgt * 0.96, W, Math.max(2, hgt * 0.02));
  // насечка у обода (ближе к борту — больший v у передней стороны)
  g.fillStyle = "#2c2c2c"; for (let x = 0; x < W; x += 6) g.fillRect(x, top + hgt * 0.985, 3, hgt * 0.12);
  // развёртка: u идёт против часовой стрелки, v растёт к центру — поворот на 180°, чтобы буквы стояли «головой наружу»
  g.save(); g.translate(W, mid); g.scale(-1, -1); g.fillStyle = "#fff"; g.textBaseline = "middle"; g.textAlign = "center";
  const fs = Math.round(hgt * 0.36);
  const put = (s, x, size, w) => { g.font = `${w} ${size}px "Unbounded","Arial Black",sans-serif`; g.fillText(s, x, 0); };
  put(text, W * 0.25, fs, 800); put(text, W * 0.75, fs, 800);
  [0, 0.5, 1].forEach((x) => put(marks, W * x, Math.round(fs * 0.6), 700));
  g.restore();
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// ── Литой диск: лицевая часть одним куском — круг с окнами между спицами, выдавлен со скруглением и выгнут
function rimFaceGeometry() {
  const R = 0.655, s = new THREE.Shape(); s.absarc(0, 0, R, 0, TAU, false);
  const w = 0.03, pair = 0.13; // полуширина спицы и половина угла между спицами пары
  const spokes = []; for (let k = 0; k < 5; k++) { const c = (k / 5) * TAU + Math.PI / 2; spokes.push(c - pair, c + pair); }
  const win = (phiL, phiR, r0, r1) => {
    const h = new THREE.Path(), pts = [];
    for (let i = 0; i <= 8; i++) { const r = r0 + (r1 - r0) * (i / 8); pts.push([r, phiL + Math.asin(w / r)]); }
    const aL = phiL + Math.asin(w / r1), aR = phiR - Math.asin(w / r1);
    for (let i = 1; i < 12; i++) { const t = aL + (aR - aL) * (i / 12); pts.push([r1, t]); }
    for (let i = 8; i >= 0; i--) { const r = r0 + (r1 - r0) * (i / 8); pts.push([r, phiR - Math.asin(w / r)]); }
    const bL = phiL + Math.asin(w / r0), bR = phiR - Math.asin(w / r0);
    for (let i = 11; i > 0; i--) { const t = bL + (bR - bL) * (i / 12); pts.push([r0, t]); }
    pts.forEach(([r, t], i) => (i ? h.lineTo(r * Math.cos(t), r * Math.sin(t)) : h.moveTo(r * Math.cos(t), r * Math.sin(t))));
    h.closePath(); return h;
  };
  for (let k = 0; k < 5; k++) {
    const a1 = spokes[2 * k], a2 = spokes[2 * k + 1], a3 = spokes[(2 * k + 2) % 10] + (k === 4 ? TAU : 0);
    s.holes.push(win(a1, a2, 0.4, 0.6));   // узкое окно внутри пары
    s.holes.push(win(a2, a3, 0.235, 0.6)); // широкое окно между парами
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.012, bevelSegments: 5, curveSegments: 128 });
  g.computeVertexNormals();
  return g;
}

function brushedTex() {
  const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
  g.fillStyle = "#8a8a8a"; g.fillRect(0, 0, 512, 512);
  for (let r = 4; r < 362; r += 1.2) { g.strokeStyle = `rgba(${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},0.05)`; g.beginPath(); g.arc(256, 256, r, 0, TAU); g.stroke(); }
  const t = new THREE.CanvasTexture(c); return t;
}

export function mountWheel(canvas, opts = {}) {
  const accent = new THREE.Color(opts.accent || "#2f7bff");
  const frozen = typeof opts.frozenT === "number", reduce = !!opts.reduced;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); }
  catch (e) { return null; }
  let maxDpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 1.75);
  renderer.setPixelRatio(maxDpr);
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  const cam = new THREE.PerspectiveCamera(22, 1, 0.1, 60);
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-3, 5, 4); scene.add(key);
  const rimL = new THREE.DirectionalLight(accent.clone().lerp(new THREE.Color(1, 1, 1), 0.55), 2.0); rimL.position.set(4, 2, -4); scene.add(rimL);

  // ── Шина
  const { g: tireGeo, v0, v1 } = tireGeometry(opts.segments || 720);
  const bump = sideBump(opts.text || "ШИНОМОНТАЖ", opts.marks || "205/55 R16", v1, v0);
  const rubber = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0d, roughness: 0.82, metalness: 0, bumpMap: bump, bumpScale: 5, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x303034), envMapIntensity: 0.9 });
  const tire = new THREE.Mesh(tireGeo, rubber);
  const tireG = new THREE.Group(); tireG.add(tire);

  // ── Диск
  const brushed = brushedTex();
  const face = new THREE.MeshPhysicalMaterial({ color: 0xf0f2f5, metalness: 0.6, roughness: 0.22, roughnessMap: brushed, clearcoat: 1, clearcoatRoughness: 0.05 });
  const pocket = new THREE.MeshPhysicalMaterial({ color: 0x24272c, metalness: 0.75, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const polished = new THREE.MeshPhysicalMaterial({ color: 0xf2f4f7, metalness: 1, roughness: 0.08 });
  const wheel = new THREE.Group();
  const faceMesh = new THREE.Mesh(rimFaceGeometry(), [face, pocket]); faceMesh.position.z = 0.2; wheel.add(faceMesh);
  const barrelPts = [[0.66, -0.335], [0.61, -0.32], [0.59, -0.22], [0.585, 0.12], [0.6, 0.2], [0.645, 0.27], [0.69, 0.3], [0.705, 0.325], [0.7, 0.345], [0.675, 0.35]].map(([r, y]) => new THREE.Vector2(r, y));
  const barrel = new THREE.Mesh(new THREE.LatheGeometry(barrelPts, 240), pocket.clone()); barrel.material.side = THREE.DoubleSide; barrel.rotation.x = Math.PI / 2; wheel.add(barrel);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.012, 16, 240), polished); lip.position.z = 0.335; wheel.add(lip);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.05, 64), polished); cap.rotation.x = Math.PI / 2; cap.position.z = 0.29; wheel.add(cap);
  const capRing = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.007, 10, 64), new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.3, clearcoat: 1 })); capRing.position.z = 0.312; wheel.add(capRing);
  const nuts = [];
  const nutGeo = new THREE.CylinderGeometry(0.024, 0.026, 0.045, 6);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + Math.PI / 2;
    const nut = new THREE.Mesh(nutGeo, polished); nut.rotation.x = Math.PI / 2;
    nut.userData.home = new THREE.Vector3(Math.cos(a) * 0.155, Math.sin(a) * 0.155, 0.285);
    nut.position.copy(nut.userData.home); wheel.add(nut); nuts.push(nut);
  }
  // тормозной диск: вентилируемый, со сверловкой
  const dc = document.createElement("canvas"); dc.width = dc.height = 512; const dg = dc.getContext("2d");
  dg.fillStyle = "#9a9ea4"; dg.fillRect(0, 0, 512, 512);
  for (let r = 120; r < 256; r += 2) { dg.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`; dg.beginPath(); dg.arc(256, 256, r, 0, TAU); dg.stroke(); }
  dg.fillStyle = "#3a3c40"; dg.beginPath(); dg.arc(256, 256, 118, 0, TAU); dg.fill();
  dg.fillStyle = "#0d0e10";
  for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU + ring * 0.1, r = 150 + ring * 32; dg.beginPath(); dg.arc(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 5.5, 0, TAU); dg.fill(); }
  const discTex = new THREE.CanvasTexture(dc); discTex.colorSpace = THREE.SRGBColorSpace;
  const discFace = new THREE.MeshStandardMaterial({ map: discTex, metalness: 0.9, roughness: 0.42 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.05, 128), [new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.8, roughness: 0.5 }), discFace, discFace]);
  disc.rotation.x = Math.PI / 2; disc.position.z = -0.06; wheel.add(disc);
  // суппорт: дуга с округлыми торцами, лак цвета сервиса; не крутится
  const cs = new THREE.Shape(); const a0 = -0.42, a1 = 0.42; cs.absarc(0, 0, 0.6, a0, a1, false); cs.absarc(Math.cos(a1) * 0.505, Math.sin(a1) * 0.505, 0.095, a1, a1 + Math.PI, false); cs.absarc(0, 0, 0.41, a1, a0, true); cs.absarc(Math.cos(a0) * 0.505, Math.sin(a0) * 0.505, 0.095, a0 + Math.PI, a0 + TAU, false);
  const caliper = new THREE.Mesh(new THREE.ExtrudeGeometry(cs, { depth: 0.11, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 5, curveSegments: 40 }), new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.28, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }));
  caliper.position.z = -0.115; caliper.rotation.z = 2.25;

  const spinner = new THREE.Group(); spinner.add(wheel); spinner.add(tireG);
  const assembly = new THREE.Group(); assembly.add(spinner); assembly.add(caliper);
  scene.add(assembly);

  // ── Пол: глянцевое отражение, поверх тёмная плёнка с затуханием к краям, мягкая тень
  const floorY = -1.0;
  const mirror = new Reflector(new THREE.CircleGeometry(8, 64), { textureWidth: 512, textureHeight: 512, color: 0x6a6a6a, clipBias: 0.002 });
  mirror.rotation.x = -Math.PI / 2; mirror.position.y = floorY; scene.add(mirror);
  const film = new THREE.Mesh(new THREE.CircleGeometry(8, 64), new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    uniforms: { uBg: { value: new THREE.Color(opts.bg || "#060607") } }, fragmentShader: "varying vec2 vP; uniform vec3 uBg; void main(){ float r = length(vP * vec2(1.,1.7)); float a = mix(0.72, 1.0, smoothstep(0.6, 2.6, r)); float sh = (1.0 - smoothstep(0.0, 1.0, r)) * 0.25; gl_FragColor = vec4(uBg, clamp(a + sh, 0., 1.));\n#include <colorspace_fragment>\n}" }));
  film.rotation.x = -Math.PI / 2; film.position.y = floorY + 0.002; scene.add(film);

  // ── Размер
  let W = 1, H = 1, dist = 6;
  function resize() {
    const r = canvas.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix();
    const halfV = Math.tan((cam.fov * Math.PI) / 360), halfH = halfV * cam.aspect;
    dist = Math.max(1.3 / halfV, 1.42 / halfH) * (opts.zoom || 1);
  }
  resize();

  // ── Поворот пальцем: горизонтальный жест, вертикальный — прокрутка страницы
  let dragYaw = 0, vel = 0, dragging = false, lastX = 0;
  canvas.style.touchAction = "pan-y";
  canvas.addEventListener("pointerdown", (ev) => { dragging = true; lastX = ev.clientX; vel = 0; canvas.setPointerCapture?.(ev.pointerId); });
  canvas.addEventListener("pointermove", (ev) => { if (!dragging) return; const dx = ev.clientX - lastX; lastX = ev.clientX; vel = dx * 0.007; dragYaw += vel; });
  const up = () => (dragging = false); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);

  function frame(t) {
    const A = reduce ? 10 : t;
    // 0-0.5 c: свет на деталях по оси; 0.4-1.2: диск на тормоз; 0.9-1.7: шина на диск (с пружиной); 1.6-2.3: гайки; 1.9-3.2: свет и разворот
    const pRim = back(span(A, 0.4, 1.15)), pTire = back(span(A, 0.9, 1.7)), pLight = ease(span(A, 1.8, 3.0)), pCam = easeIO(span(A, 1.7, 3.3));
    wheel.position.z = (1 - pRim) * 0.6; wheel.rotation.z = (1 - pRim) * 1.4;
    tireG.position.z = (1 - pTire) * 1.15; tireG.rotation.z = (1 - pTire) * -0.7;
    nuts.forEach((nut, i) => { const p = easeIO(span(A, 1.6 + i * 0.08, 2.1 + i * 0.08)); nut.position.copy(nut.userData.home); nut.position.z += (1 - p) * 0.9; nut.rotation.y = (1 - p) * 10; });
    const fadeIn = ease(span(A, 0, 0.5));
    renderer.toneMappingExposure = (0.75 + 0.45 * pLight) * fadeIn;
    scene.environmentIntensity = 0.55 + 0.45 * pLight;
    key.intensity = 0.5 + 1.3 * pLight; rimL.intensity = 2.6 - 0.8 * pLight;
    mirror.visible = pLight > 0.05;
    if (!dragging) { vel *= 0.94; dragYaw += vel; dragYaw *= 0.99; }
    const idle = Math.max(0, A - 3.2);
    spinner.rotation.z = -idle * 0.1;
    assembly.rotation.y = (1 - pCam) * (1.2 + 0.06 * A) + pCam * (0.55 + 0.12 * Math.sin(idle * 0.3)) + dragYaw;
    assembly.position.z = -(1 - pCam) * 0.45;
    const d = dist * (1.3 - 0.3 * pCam);
    cam.position.set(0, 0.32 + (1 - pCam) * 0.2, d); cam.lookAt(0, 0.08, 0);
    key.position.set(-3 + 1.5 * Math.sin(idle * 0.22), 5, 4);
    renderer.render(scene, cam);
  }
  let raf = 0, visible = true, slow = 0, last = 0;
  const t0 = performance.now();
  function loop(now) {
    raf = 0; if (!visible || document.hidden) return;
    if (last) { const dt = now - last; slow = dt > 30 ? slow + 1 : Math.max(0, slow - 1); if (slow > 24) { if (maxDpr > 0.85) { maxDpr -= 0.25; renderer.setPixelRatio(maxDpr); resize(); } else mirror.visible = false; slow = 0; } }
    last = now; frame((now - t0) / 1000); raf = requestAnimationFrame(loop);
  }
  const onResize = () => { resize(); if (frozen || reduce) frame(frozen ? opts.frozenT : 10); };
  window.addEventListener("resize", onResize);
  const go = () => {
    if (frozen) return frame(opts.frozenT);
    if (reduce) return frame(10);
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }).observe(canvas);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && !raf) raf = requestAnimationFrame(loop); });
    raf = requestAnimationFrame(loop);
  };
  (document.fonts ? document.fonts.load('800 40px "Unbounded"').catch(() => 0).then(() => document.fonts.ready) : Promise.resolve()).then(() => {
    const c = sideBump(opts.text || "ШИНОМОНТАЖ", opts.marks || "205/55 R16", v1, v0).image; bump.image = c; bump.needsUpdate = true; go();
  });
  return {
    setMarks(text, marks) { bump.image = sideBump(text, marks, v1, v0).image; bump.needsUpdate = true; if (frozen || reduce) frame(frozen ? opts.frozenT : 10); },
    destroy() { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); renderer.dispose(); },
  };
}
