// Колесо в настоящем 3D (three.js): шина с объёмным протектором и надписью на боковине, литой диск,
// тормозной диск и суппорт цвета сервиса. Анимация «переобувки»: детали собираются в колесо.
// mountWheel(canvas, { text, marks, accent, frozenT }) → { setRadius(r), destroy() }
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeIO = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const span = (t, a, b) => clamp((t - a) / (b - a));

// Сечение шины (r — радиус, y — вдоль оси), от внутреннего борта к внешнему
function tireProfile() {
  const P = [];
  const side = (sgn, rev) => {
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const s = i / 18; // от борта (0) до плеча (1)
      const r = 0.69 + 0.27 * s;
      const y = sgn * (0.33 + 0.045 * Math.sin(Math.PI * Math.min(1, s * 1.15)) - 0.03 * s * s);
      pts.push([r, y]);
    }
    return rev ? pts.reverse() : pts;
  };
  P.push(...side(-1, false));
  // плечо и беговая дорожка (под блоками протектора)
  for (let i = 0; i <= 24; i++) {
    const a = i / 24, y = -0.30 + 0.60 * a, k = Math.abs(y) / 0.30;
    P.push([0.968 - 0.012 * Math.pow(k, 6), y]);
  }
  P.push(...side(1, true));
  return P.map(([r, y]) => new THREE.Vector2(r, y));
}

// Холст боковины: рельеф надписи (белое = выпукло). u — угол, v — точка сечения
function sideBump(text, marks, vFrom, vTo) {
  const W = 4096, H = 512, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  // кольца-ободки, как у настоящей шины
  const row = (v) => (1 - v) * H; // у текстуры холста v=0 внизу
  const y0 = row(vFrom), y1 = row(vTo), mid = (y0 + y1) / 2, hgt = Math.abs(y1 - y0);
  g.fillStyle = "#666";
  g.fillRect(0, Math.min(y0, y1) + hgt * 0.08, W, Math.max(2, hgt * 0.025));
  g.fillRect(0, Math.max(y0, y1) - hgt * 0.1, W, Math.max(2, hgt * 0.025));
  g.save(); g.translate(0, mid); g.scale(1, Math.sign(y1 - y0) || 1);
  g.fillStyle = "#fff"; g.textBaseline = "middle";
  const fs = Math.round(hgt * 0.42);
  g.font = `800 ${fs}px "Unbounded","Arial Black",sans-serif`;
  const put = (str, x, size, w) => { g.font = `${w} ${size}px "Unbounded","Arial Black",sans-serif`; g.textAlign = "center"; g.fillText(str, x, 0); };
  // надпись дважды по кругу, между ними размер шины
  put(text, W * 0.25, fs, 800); put(text, W * 0.75, fs, 800);
  put(marks, W * 0.5, Math.round(fs * 0.62), 700); put(marks, W * 0.0, Math.round(fs * 0.62), 700); put(marks, W * 1.0, Math.round(fs * 0.62), 700);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

function caliperShape() {
  const s = new THREE.Shape(), a0 = -0.5, a1 = 0.5, r0 = 0.40, r1 = 0.585;
  s.absarc(0, 0, r1, a0, a1, false); s.absarc(0, 0, r0, a1, a0, true);
  return s;
}

function spokeShape() {
  // тонкая спица от ступицы к ободу (вдоль +x), сужается к ободу
  const s = new THREE.Shape();
  s.moveTo(0.17, -0.038); s.bezierCurveTo(0.33, -0.03, 0.5, -0.024, 0.665, -0.03);
  s.lineTo(0.665, 0.03); s.bezierCurveTo(0.5, 0.024, 0.33, 0.03, 0.17, 0.038);
  s.closePath();
  return s;
}

export function mountWheel(canvas, opts = {}) {
  const accent = new THREE.Color(opts.accent || "#2f7bff");
  const frozen = typeof opts.frozenT === "number";
  const reduce = !!opts.reduced;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) { canvas.dispatchEvent(new CustomEvent("wheel:fail")); return null; }
  let maxDpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 1.75);
  renderer.setPixelRatio(maxDpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environmentIntensity = 0.9;

  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-3, 4, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(accent.clone().lerp(new THREE.Color(1, 1, 1), 0.35), 3.0); rim.position.set(4, 1.5, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xbfd2ff, 0.5); fill.position.set(2, -2, 3); scene.add(fill);

  // ── Шина
  const prof = tireProfile();
  const tireGeo = new THREE.LatheGeometry(prof, 360);
  tireGeo.rotateX(Math.PI / 2); // ось колеса → Z (к зрителю)
  // какие v у передней боковины (y>0 → после поворота z>0)
  const n = prof.length - 1;
  let vF0 = 1, vF1 = 0; prof.forEach((p, i) => { if (p.y > 0.05 && p.x > 0.74 && p.x < 0.93) { vF0 = Math.min(vF0, i / n); vF1 = Math.max(vF1, i / n); } });
  const bump = sideBump(opts.text || "ШИНОМОНТАЖ", opts.marks || "225/45 R17", vF1, vF0);
  const rubber = new THREE.MeshPhysicalMaterial({ color: 0x0f0f10, roughness: 0.74, metalness: 0, bumpMap: bump, bumpScale: 7, sheen: 0.35, sheenRoughness: 0.55, sheenColor: new THREE.Color(0x262628), envMapIntensity: 0.5 });
  const tire = new THREE.Group();
  tire.add(new THREE.Mesh(tireGeo, rubber));
  // протектор: три ряда объёмных блоков «ёлочкой»
  const blockMat = new THREE.MeshPhysicalMaterial({ color: 0x121213, roughness: 0.8, envMapIntensity: 0.5, sheen: 0.3, sheenColor: new THREE.Color(0x2a2a2e) });
  const N = 84, rows = [[-0.075, 0.115, 0], [0.075, 0.115, 0.5], [-0.215, 0.13, 0.25], [0.215, 0.13, 0.75]];
  const blockGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
  const blocks = new THREE.InstancedMesh(blockGeo, blockMat, N * rows.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  let k = 0;
  rows.forEach(([z, w, off]) => {
    for (let i = 0; i < N; i++) {
      const a = ((i + off) / N) * TAU;
      pos.set(Math.cos(a) * 0.979, Math.sin(a) * 0.979, z);
      e.set(0, 0, a); q.setFromEuler(e);
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.sign(z) * (Math.abs(z) > 0.1 ? 0.42 : 0.22));
      q.multiply(tilt);
      sc.set(0.026, (TAU / N) * 0.8, w);
      m4.compose(pos, q, sc); blocks.setMatrixAt(k++, m4);
    }
  });
  tire.add(blocks);

  // ── Диск: обод (токарка), спицы (лицо — полированное, бока — графит), ступица, гайки
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.16, clearcoat: 0.6, clearcoatRoughness: 0.1 });
  const graphite = new THREE.MeshPhysicalMaterial({ color: 0x2a2d31, metalness: 0.75, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
  const wheel = new THREE.Group();
  const barrel = new THREE.LatheGeometry([
    [0.66, -0.33], [0.6, -0.31], [0.585, -0.2], [0.58, 0.18], [0.6, 0.27], [0.66, 0.30], [0.705, 0.315], [0.71, 0.34], [0.69, 0.355], [0.66, 0.345],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 200);
  barrel.rotateX(Math.PI / 2);
  wheel.add(new THREE.Mesh(barrel, graphite.clone()));
  wheel.children[0].material.side = THREE.DoubleSide;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.695, 0.012, 12, 200), silver); lip.position.z = 0.345; wheel.add(lip);
  const spokeGeo = new THREE.ExtrudeGeometry(spokeShape(), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 4, curveSegments: 24 });
  spokeGeo.translate(0, 0, -0.025);
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(spokeGeo, [silver, graphite]);
    s.rotation.z = (Math.floor(i / 2) / 5) * TAU + Math.PI / 2 + (i % 2 ? 0.17 : -0.17);
    // вогнутый диск: у ступицы спицы глубже, у обода ближе к зрителю
    const piv = new THREE.Group(); piv.rotation.z = s.rotation.z; s.rotation.z = 0;
    s.rotation.y = -0.2; s.position.z = 0.2;
    piv.add(s); wheel.add(piv);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.205, 0.12, 64), graphite); hub.rotation.x = Math.PI / 2; hub.position.z = 0.17; wheel.add(hub);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.05, 48), silver); cap.rotation.x = Math.PI / 2; cap.position.z = 0.24; wheel.add(cap);
  const capRing = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.008, 8, 48), new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.3, clearcoat: 1 })); capRing.position.z = 0.265; wheel.add(capRing);
  const nuts = [];
  const nutGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.05, 6);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + Math.PI / 2 + TAU / 10;
    const nut = new THREE.Mesh(nutGeo, silver); nut.rotation.x = Math.PI / 2;
    nut.userData.home = new THREE.Vector3(Math.cos(a) * 0.135, Math.sin(a) * 0.135, 0.245);
    nut.position.copy(nut.userData.home); wheel.add(nut); nuts.push(nut);
  }

  // ── Тормоз: диск со сверловкой (крутится с колесом), суппорт (не крутится)
  const dc = document.createElement("canvas"); dc.width = dc.height = 512; const dg = dc.getContext("2d");
  dg.fillStyle = "#8c9096"; dg.fillRect(0, 0, 512, 512);
  for (let r = 120; r < 250; r += 3) { dg.strokeStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.06})`; dg.beginPath(); dg.arc(256, 256, r, 0, TAU); dg.stroke(); }
  dg.fillStyle = "#16171a";
  for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU + ring * 0.09, r = 150 + ring * 30; dg.beginPath(); dg.arc(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 6, 0, TAU); dg.fill(); }
  const discTex = new THREE.CanvasTexture(dc); discTex.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.035, 96), [new THREE.MeshStandardMaterial({ color: 0x5a5e64, metalness: 0.9, roughness: 0.45 }), new THREE.MeshStandardMaterial({ map: discTex, metalness: 0.85, roughness: 0.38 }), new THREE.MeshStandardMaterial({ map: discTex, metalness: 0.85, roughness: 0.38 })]);
  disc.rotation.x = Math.PI / 2; disc.position.z = -0.07; wheel.add(disc);
  const caliper = new THREE.Mesh(new THREE.ExtrudeGeometry(caliperShape(), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 4, curveSegments: 32 }), new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.35, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12 }));
  caliper.position.z = -0.12;

  // Сборка: всё колесо крутится в «spinner», суппорт рядом и не крутится
  const spinner = new THREE.Group(); spinner.add(wheel); spinner.add(tire);
  const assembly = new THREE.Group(); assembly.add(spinner); assembly.add(caliper);
  const caliperHome = 2.2; caliper.rotation.z = caliperHome;
  scene.add(assembly);

  // Мягкая тень-пятно под колесом
  const sh = document.createElement("canvas"); sh.width = sh.height = 128; const sg = sh.getContext("2d");
  const grd = sg.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, "rgba(0,0,0,.85)"); grd.addColorStop(1, "rgba(0,0,0,0)"); sg.fillStyle = grd; sg.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.06; scene.add(shadow);

  // ── Камера и размер
  let W = 1, H = 1;
  function resize() {
    const r = canvas.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false); cam.aspect = W / H;
    // колесо (радиус ~1.05 с тенью) всегда целиком в кадре
    const fitH = 1.32 / Math.tan((cam.fov * Math.PI) / 360), fitW = fitH / Math.min(1, cam.aspect);
    cam.userData.dist = Math.max(fitH, fitW) * (opts.zoom || 1);
    cam.updateProjectionMatrix();
  }
  resize();

  // ── Управление: горизонтальный жест крутит колесо (вертикальный оставляем прокрутке страницы)
  let dragYaw = 0, vel = 0, dragging = false, lastX = 0;
  canvas.style.touchAction = "pan-y";
  canvas.addEventListener("pointerdown", (ev) => { dragging = true; lastX = ev.clientX; vel = 0; canvas.setPointerCapture?.(ev.pointerId); });
  canvas.addEventListener("pointermove", (ev) => { if (!dragging) return; const dx = ev.clientX - lastX; lastX = ev.clientX; vel = dx * 0.006; dragYaw += vel; });
  const up = () => { dragging = false; };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);

  // ── Кадр
  const t0 = performance.now();
  let slow = 0, last = 0, raf = 0, visible = true;
  function frame(t) {
    // Разобранный вид по оси: тормоз на месте, обод, шина и гайки впереди. По очереди садятся на место
    const A = reduce ? 10 : t;
    const pRim = easeIO(span(A, 0.35, 1.15)), pTire = easeIO(span(A, 0.9, 1.85)), pLight = ease(span(A, 1.8, 3.0)), pCam = easeIO(span(A, 1.7, 3.3));
    wheel.position.z = (1 - pRim) * 0.55; wheel.rotation.z = (1 - pRim) * 1.6;
    tire.position.set(0, 0, (1 - pTire) * 1.1); tire.rotation.z = (1 - pTire) * -0.8;
    nuts.forEach((nut, i) => { const p = easeIO(span(A, 1.75 + i * 0.09, 2.3 + i * 0.09)); nut.position.copy(nut.userData.home); nut.position.z += (1 - p) * 0.95; nut.rotation.y = (1 - p) * 10; });
    const fadeIn = ease(span(A, 0, 0.6));
    // свет
    renderer.toneMappingExposure = (0.55 + 0.5 * pLight) * fadeIn;
    scene.environmentIntensity = 0.45 + 0.55 * pLight;
    key.intensity = 0.9 + 1.7 * pLight;
    rim.intensity = 3.4 - 0.8 * pLight;
    // вращение: после сборки колесо медленно катится и покачивается, жест добавляет поворот
    if (!dragging) { vel *= 0.94; dragYaw += vel; dragYaw *= 0.985; }
    const idle = Math.max(0, A - 3.2);
    spinner.rotation.z = -idle * 0.12;
    // сначала сбоку (видно, как детали идут по оси), потом разворот к зрителю
    const yaw = (1 - pCam) * (1.15 + 0.08 * A) + pCam * (0.62 + 0.1 * Math.sin(idle * 0.35)) + dragYaw;
    assembly.rotation.y = yaw; assembly.rotation.x = -0.06 - (1 - pCam) * 0.08;
    assembly.position.z = -(1 - pCam) * 0.5;
    const d = cam.userData.dist * (1.32 - 0.32 * pCam);
    cam.position.set(0, 0.12, d); cam.lookAt(0, 0, 0);
    key.position.set(-3 + 1.2 * Math.sin(idle * 0.25), 4, 4);
    renderer.render(scene, cam);
  }
  function loop(now) {
    raf = 0; if (!visible || document.hidden) return;
    if (last) { const dt = now - last; slow = dt > 30 ? slow + 1 : Math.max(0, slow - 1); if (slow > 24 && maxDpr > 0.8) { maxDpr -= 0.25; renderer.setPixelRatio(maxDpr); resize(); slow = 0; } }
    last = now; frame((now - t0) / 1000); raf = requestAnimationFrame(loop);
  }
  const onResize = () => { resize(); if (frozen || reduce) frame(frozen ? opts.frozenT : 10); };
  window.addEventListener("resize", onResize);
  const go = () => {
    if (frozen) { frame(opts.frozenT); return; }
    if (reduce) { frame(10); return; }
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }).observe(canvas);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && !raf) raf = requestAnimationFrame(loop); });
    raf = requestAnimationFrame(loop);
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { bump.needsUpdate = true; go(); });
  return {
    setMarks(text, marks) { const c = sideBump(text, marks, vF1, vF0).image; bump.image = c; bump.needsUpdate = true; if (frozen || reduce) frame(frozen ? opts.frozenT : 10); },
    destroy() { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); renderer.dispose(); },
  };
}
