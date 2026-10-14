// «Колесо»: 3D-колесо из кода (без файлов моделей). Сплошная резина с прорезанными канавками, на боковине
// рельефом название сервиса и размер шины; литой диск, тормоз со сверловкой, суппорт цвета сервиса.
// В начале детали стоят по оси и собираются в колесо, потом включается свет и колесо разворачивается к зрителю.
import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { TAU, dragYaw, ease, easeIO, runLoop, settle, span, sstep } from "./loop";

export type WheelOpts = { text: string; marks: string; accent: string; bg: string; font: string; reduced: boolean; frozenT?: number };
export type WheelScene = { setMarks(marks: string): void; destroy(): void };

// Студия для отражений: тёмный зал, большие софтбоксы сверху и спереди, вертикальные полосы по бокам
function studioEnv(renderer: THREE.WebGLRenderer) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x111114);
  const box = (w: number, h: number, x: number, y: number, z: number, k: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  box(9, 4, 0, 7, 1, 2.6);
  box(1.2, 8, -6, 1, 3, 3.4);
  box(1.0, 8, 6, 1, -2, 2.0);
  box(9, 4.5, 1.5, 3, 8, 1.5);
  box(1.0, 6, 5, 0.5, 4, 1.4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0x050506 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3;
  s.add(floor);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return env;
}

// Сечение шины (радиус, координата вдоль оси): внутренний борт → плечо → беговая дорожка → плечо → внешний борт
function profilePoints(): [number, number][] {
  const side = (sgn: number) => Array.from({ length: 27 }, (_, i): [number, number] => {
    const s = i / 26;
    return [0.69 + 0.255 * s, sgn * (0.335 + 0.05 * Math.sin(Math.PI * Math.min(1, s * 1.12)) - 0.03 * s * s)];
  });
  const shoulder = (sgn: number) => Array.from({ length: 12 }, (_, i): [number, number] => {
    const q = (((i + 1) / 13) * Math.PI) / 2;
    return [0.945 + 0.055 * Math.sin(q), sgn * (0.305 - 0.045 * (1 - Math.cos(q)))];
  });
  const tread = Array.from({ length: 61 }, (_, i): [number, number] => {
    const y = -0.26 + 0.52 * (i / 60);
    return [1.0 - 0.006 * Math.pow(Math.abs(y) / 0.26, 4), y];
  });
  return [...side(-1), ...shoulder(-1), ...tread, ...shoulder(1).reverse(), ...side(1).reverse()];
}

// Глубина канавок протектора в точке (угол a, поперёк y): две продольные, косые «ёлочкой» и тонкие ламели
function grooveDepth(a: number, y: number) {
  const ay = Math.abs(y);
  if (ay > 0.27) return 0;
  let d = 0;
  for (const c of [0.085, 0.2]) d = Math.max(d, 0.03 * (1 - sstep(0.011, 0.016, Math.abs(ay - c))));
  const N = 46;
  const fr = Math.abs(((((a * N) / TAU + ay * 3.2) % 1) + 1) % 1 - 0.5);
  if (ay > 0.095) d = Math.max(d, 0.026 * sstep(0.455, 0.47, fr) * sstep(0.27, 0.25, ay));
  const fr2 = Math.abs(((((a * N * 2) / TAU + ay * 5 + 0.25) % 1) + 1) % 1 - 0.5);
  d = Math.max(d, 0.012 * sstep(0.475, 0.485, fr2) * (ay < 0.075 || (ay > 0.1 && ay < 0.19) ? 1 : 0));
  return d;
}

function tireGeometry(seg: number) {
  const prof = profilePoints(), n = prof.length;
  const pos = new Float32Array((seg + 1) * n * 3), uv = new Float32Array((seg + 1) * n * 2);
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * TAU, ca = Math.cos(a), sa = Math.sin(a);
    for (let j = 0; j < n; j++) {
      let [r] = prof[j];
      const y = prof[j][1];
      if (r > 0.99) r -= grooveDepth(a, y);
      const k = i * n + j;
      pos.set([ca * r, sa * r, y], k * 3);
      uv.set([i / seg, j / (n - 1)], k * 2);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < seg; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j, b = (i + 1) * n + j; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // полоса передней боковины, куда ложится надпись
  let v0 = 1, v1 = 0;
  prof.forEach(([r, y], j) => { if (y > 0.05 && r > 0.74 && r < 0.92) { v0 = Math.min(v0, j / (n - 1)); v1 = Math.max(v1, j / (n - 1)); } });
  return { g, v0, v1 };
}

// Рельеф боковины (белое — выпукло): ободки, насечка у борта, надпись дважды по кругу и размер шины
function drawSide(c: HTMLCanvasElement, text: string, marks: string, font: string, vA: number, vB: number) {
  const W = c.width, H = c.height, g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  const yA = (1 - vA) * H, yB = (1 - vB) * H, top = Math.min(yA, yB), hgt = Math.abs(yB - yA), mid = top + hgt / 2;
  g.fillStyle = "#5a5a5a";
  g.fillRect(0, top + hgt * 0.02, W, Math.max(2, hgt * 0.02));
  g.fillRect(0, top + hgt * 0.96, W, Math.max(2, hgt * 0.02));
  g.fillStyle = "#2c2c2c";
  for (let x = 0; x < W; x += 6) g.fillRect(x, top + hgt * 0.985, 3, hgt * 0.12);
  // развёртка идёт против часовой стрелки, к центру колеса — поворот на 180°, чтобы буквы стояли «головой наружу»
  g.save();
  g.translate(W, mid);
  g.scale(-1, -1);
  g.fillStyle = "#fff";
  g.textBaseline = "middle";
  g.textAlign = "center";
  const fs = Math.round(hgt * 0.36);
  const put = (s: string, x: number, size: number, w: number) => {
    g.font = `${w} ${size}px ${font}, "Arial Black", sans-serif`;
    // длинное название сжимается, чтобы две надписи не наезжали друг на друга
    const max = W * 0.46, m = g.measureText(s).width;
    if (m > max) g.font = `${w} ${Math.floor((size * max) / m)}px ${font}, "Arial Black", sans-serif`;
    g.fillText(s, x, 0);
  };
  put(text, W * 0.25, fs, 800);
  put(text, W * 0.75, fs, 800);
  [0, 0.5, 1].forEach((x) => put(marks, W * x, Math.round(fs * 0.6), 700));
  g.restore();
}

// Лицевая часть литого диска одним куском: пять сдвоенных спиц, окна с прямыми боками и дугами
function rimFaceGeometry() {
  const R = 0.655, s = new THREE.Shape();
  s.absarc(0, 0, R, 0, TAU, false);
  const w = 0.03, pair = 0.13;
  const spokes: number[] = [];
  for (let k = 0; k < 5; k++) { const c = (k / 5) * TAU + Math.PI / 2; spokes.push(c - pair, c + pair); }
  const win = (phiL: number, phiR: number, r0: number, r1: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) { const r = r0 + (r1 - r0) * (i / 8); pts.push([r, phiL + Math.asin(w / r)]); }
    const aL = phiL + Math.asin(w / r1), aR = phiR - Math.asin(w / r1);
    for (let i = 1; i < 12; i++) pts.push([r1, aL + (aR - aL) * (i / 12)]);
    for (let i = 8; i >= 0; i--) { const r = r0 + (r1 - r0) * (i / 8); pts.push([r, phiR - Math.asin(w / r)]); }
    const bL = phiL + Math.asin(w / r0), bR = phiR - Math.asin(w / r0);
    for (let i = 11; i > 0; i--) pts.push([r0, bL + (bR - bL) * (i / 12)]);
    const h = new THREE.Path();
    pts.forEach(([r, t], i) => (i ? h.lineTo(r * Math.cos(t), r * Math.sin(t)) : h.moveTo(r * Math.cos(t), r * Math.sin(t))));
    h.closePath();
    return h;
  };
  for (let k = 0; k < 5; k++) {
    const a1 = spokes[2 * k], a2 = spokes[2 * k + 1], a3 = spokes[(2 * k + 2) % 10] + (k === 4 ? TAU : 0);
    s.holes.push(win(a1, a2, 0.4, 0.6), win(a2, a3, 0.235, 0.6));
  }
  return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.012, bevelSegments: 5, curveSegments: 128 });
}

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!);
  return new THREE.CanvasTexture(c);
}

export function mountWheel(canvas: HTMLCanvasElement, o: WheelOpts): WheelScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  const accent = new THREE.Color(o.accent);
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  let dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  const cam = new THREE.PerspectiveCamera(22, 1, 0.1, 60);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-3, 5, 4);
  const rimLight = new THREE.DirectionalLight(accent.clone().lerp(new THREE.Color(1, 1, 1), 0.55), 2.0);
  rimLight.position.set(4, 2, -4);
  scene.add(key, rimLight);

  // ── Шина
  const { g: tireGeo, v0, v1 } = tireGeometry(small ? 480 : 720);
  const sideCanvas = document.createElement("canvas");
  sideCanvas.width = small ? 2048 : 4096;
  sideCanvas.height = small ? 512 : 1024;
  let marks = o.marks;
  const redrawSide = () => drawSide(sideCanvas, o.text, marks, o.font, v1, v0);
  redrawSide();
  const bump = new THREE.CanvasTexture(sideCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.anisotropy = 8;
  const rubber = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0d, roughness: 0.82, metalness: 0, bumpMap: bump, bumpScale: 5, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x303034), envMapIntensity: 0.9 });
  const tire = new THREE.Group();
  tire.add(new THREE.Mesh(tireGeo, rubber));

  // ── Диск
  const brushed = canvasTex(512, (g) => {
    g.fillStyle = "#8a8a8a";
    g.fillRect(0, 0, 512, 512);
    for (let r = 4; r < 362; r += 1.2) {
      const v = Math.random() < 0.5 ? 255 : 0;
      g.strokeStyle = `rgba(${v},${v},${v},0.05)`;
      g.beginPath();
      g.arc(256, 256, r, 0, TAU);
      g.stroke();
    }
  });
  const face = new THREE.MeshPhysicalMaterial({ color: 0xf0f2f5, metalness: 0.6, roughness: 0.22, roughnessMap: brushed, clearcoat: 1, clearcoatRoughness: 0.05 });
  const pocket = new THREE.MeshPhysicalMaterial({ color: 0x24272c, metalness: 0.75, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const polished = new THREE.MeshPhysicalMaterial({ color: 0xf2f4f7, metalness: 1, roughness: 0.08 });
  const wheel = new THREE.Group();
  const faceMesh = new THREE.Mesh(rimFaceGeometry(), [face, pocket]);
  faceMesh.position.z = 0.2;
  const barrelPts = [[0.66, -0.335], [0.61, -0.32], [0.59, -0.22], [0.585, 0.12], [0.6, 0.2], [0.645, 0.27], [0.69, 0.3], [0.705, 0.325], [0.7, 0.345], [0.675, 0.35]].map(([r, y]) => new THREE.Vector2(r, y));
  const barrelMat = pocket.clone();
  barrelMat.side = THREE.DoubleSide;
  const barrel = new THREE.Mesh(new THREE.LatheGeometry(barrelPts, 240), barrelMat);
  barrel.rotation.x = Math.PI / 2;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.012, 16, 240), polished);
  lip.position.z = 0.335;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.05, 64), polished);
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.29;
  const capRing = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.007, 10, 64), new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.3, clearcoat: 1 }));
  capRing.position.z = 0.312;
  wheel.add(faceMesh, barrel, lip, cap, capRing);
  const nutGeo = new THREE.CylinderGeometry(0.024, 0.026, 0.045, 6);
  const nuts = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * TAU + Math.PI / 2;
    const nut = new THREE.Mesh(nutGeo, polished);
    nut.rotation.x = Math.PI / 2;
    nut.userData.home = new THREE.Vector3(Math.cos(a) * 0.155, Math.sin(a) * 0.155, 0.285);
    wheel.add(nut);
    return nut;
  });
  // тормозной диск со сверловкой
  const discTex = canvasTex(512, (g) => {
    g.fillStyle = "#9a9ea4";
    g.fillRect(0, 0, 512, 512);
    for (let r = 120; r < 256; r += 2) { g.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`; g.beginPath(); g.arc(256, 256, r, 0, TAU); g.stroke(); }
    g.fillStyle = "#3a3c40";
    g.beginPath(); g.arc(256, 256, 118, 0, TAU); g.fill();
    g.fillStyle = "#0d0e10";
    for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU + ring * 0.1, r = 150 + ring * 32; g.beginPath(); g.arc(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 5.5, 0, TAU); g.fill(); }
  });
  discTex.colorSpace = THREE.SRGBColorSpace;
  const discFace = new THREE.MeshStandardMaterial({ map: discTex, metalness: 0.9, roughness: 0.42 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.05, 128), [new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.8, roughness: 0.5 }), discFace, discFace]);
  disc.rotation.x = Math.PI / 2;
  disc.position.z = -0.06;
  wheel.add(disc);
  // суппорт: дуга со скруглёнными торцами, лак цвета сервиса; не крутится вместе с колесом
  const cs = new THREE.Shape(), a0 = -0.42, a1 = 0.42;
  cs.absarc(0, 0, 0.6, a0, a1, false);
  cs.absarc(Math.cos(a1) * 0.505, Math.sin(a1) * 0.505, 0.095, a1, a1 + Math.PI, false);
  cs.absarc(0, 0, 0.41, a1, a0, true);
  cs.absarc(Math.cos(a0) * 0.505, Math.sin(a0) * 0.505, 0.095, a0 + Math.PI, a0 + TAU, false);
  const caliper = new THREE.Mesh(
    new THREE.ExtrudeGeometry(cs, { depth: 0.11, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 5, curveSegments: 40 }),
    new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.28, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }),
  );
  caliper.position.z = -0.115;
  caliper.rotation.z = 2.25;

  const spinner = new THREE.Group();
  spinner.add(wheel, tire);
  const assembly = new THREE.Group();
  assembly.add(spinner, caliper);
  scene.add(assembly);

  // ── Пол: глянцевое отражение под тёмной плёнкой, к краям уходит в фон
  const floorY = -1.0;
  let mirror: Reflector | null = new Reflector(new THREE.CircleGeometry(8, 64), { textureWidth: 512, textureHeight: 512, color: 0x6a6a6a, clipBias: 0.002 });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = floorY;
  scene.add(mirror);
  const film = new THREE.Mesh(
    new THREE.CircleGeometry(8, 64),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uBg: { value: new THREE.Color(o.bg) } },
      vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
      // у колеса — отражение и мягкая тень, дальше пол растворяется в цвете страницы
      fragmentShader: "varying vec2 vP; uniform vec3 uBg; void main(){ float r = length(vP * vec2(1.,1.7)); float a = mix(0.72, 1.0, smoothstep(0.6, 2.6, r)); float sh = (1.0 - smoothstep(0.0, 1.0, r)) * 0.25; gl_FragColor = vec4(uBg, clamp(a + sh, 0., 1.)); \n#include <colorspace_fragment>\n}",
    }),
  );
  film.rotation.x = -Math.PI / 2;
  film.position.y = floorY + 0.002;
  scene.add(film);

  let dist = 6;
  const resize = () => {
    const r = canvas.getBoundingClientRect(), W = Math.max(1, r.width), H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
    const halfV = Math.tan((cam.fov * Math.PI) / 360);
    dist = Math.max(1.3 / halfV, 1.42 / (halfV * cam.aspect));
  };
  resize();
  const drag = dragYaw(canvas, 0.007);

  const frame = (t: number) => {
    // 0-0.5 с: детали по оси проступают из темноты; 0.4-1.15: диск на тормоз; 0.9-1.7: шина на диск;
    // 1.6-2.4: гайки; 1.8-3.3: свет и разворот к зрителю; дальше колесо медленно катится
    const pRim = settle(span(t, 0.4, 1.15)), pTire = settle(span(t, 0.9, 1.7)), pLight = ease(span(t, 1.8, 3.0)), pCam = easeIO(span(t, 1.7, 3.3));
    wheel.position.z = (1 - pRim) * 0.6;
    wheel.rotation.z = (1 - pRim) * 1.4;
    tire.position.z = (1 - pTire) * 1.15;
    tire.rotation.z = (1 - pTire) * -0.7;
    nuts.forEach((nut, i) => {
      const p = easeIO(span(t, 1.6 + i * 0.08, 2.1 + i * 0.08));
      nut.position.copy(nut.userData.home as THREE.Vector3);
      nut.position.z += (1 - p) * 0.9;
      nut.rotation.y = (1 - p) * 10;
    });
    renderer.toneMappingExposure = (0.75 + 0.45 * pLight) * ease(span(t, 0, 0.5));
    scene.environmentIntensity = 0.55 + 0.45 * pLight;
    key.intensity = 0.5 + 1.3 * pLight;
    rimLight.intensity = 2.6 - 0.8 * pLight;
    if (mirror) mirror.visible = pLight > 0.05;
    drag.step(0.99);
    const idle = Math.max(0, t - 3.2);
    spinner.rotation.z = -idle * 0.1;
    assembly.rotation.y = (1 - pCam) * (1.2 + 0.06 * t) + pCam * (0.55 + 0.12 * Math.sin(idle * 0.3)) + drag.s.yaw;
    assembly.position.z = -(1 - pCam) * 0.45;
    const d = dist * (1.3 - 0.3 * pCam);
    cam.position.set(0, 0.32 + (1 - pCam) * 0.2, d);
    cam.lookAt(0, 0.08, 0);
    key.position.set(-3 + 1.5 * Math.sin(idle * 0.22), 5, 4);
    renderer.render(scene, cam);
  };

  const still = o.reduced || o.frozenT !== undefined;
  const stillT = o.frozenT ?? 10;
  const onResize = () => { resize(); if (still) frame(stillT); };
  window.addEventListener("resize", onResize);
  const stop = still
    ? (frame(stillT), () => {})
    : runLoop(canvas, frame, () => {
        if (dpr > 0.85) { dpr -= 0.25; renderer.setPixelRatio(dpr); resize(); }
        else if (mirror) { scene.remove(mirror); mirror.dispose(); mirror = null; }
      });

  return {
    setMarks(m: string) {
      marks = m;
      redrawSide();
      bump.needsUpdate = true;
      if (still) frame(stillT);
    },
    destroy() {
      stop();
      drag.off();
      window.removeEventListener("resize", onResize);
      scene.traverse((x) => { if (x instanceof THREE.Mesh) { x.geometry.dispose(); [x.material].flat().forEach((m: THREE.Material) => m.dispose()); } });
      mirror?.dispose();
      renderer.dispose();
    },
  };
}

