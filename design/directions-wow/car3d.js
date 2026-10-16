// Машина в 3D (three.js) на диагностическом стенде: луч сканирует кузов, за ним светящаяся сетка,
// потом зажигается студийный свет. Машину можно крутить пальцем, рамки и подписи держатся на колёсах.
// mountCar(canvas, overlay, { url, accent, paint, frozenT, reduced, onReady }) → { rescan(), setTags(front, rear) }
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { Reflector } from "three/addons/objects/Reflector.js";

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeIO = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const span = (t, a, b) => clamp((t - a) / (b - a));

// Общие для всех материалов машины параметры «скана»
const SCAN = { uInv: { value: new THREE.Matrix4() }, uScanZ: { value: 99 }, uHolo: { value: 0 }, uLit: { value: 0 }, uAccent: { value: new THREE.Color("#ff3b30") }, uDir: { value: 1 } };

function addScan(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SCAN);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vScanPos;\nuniform mat4 uInv;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvScanPos = (uInv * modelMatrix * vec4(transformed, 1.0)).xyz; // в осях машины");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vScanPos;\nuniform float uScanZ, uHolo, uLit, uDir;\nuniform vec3 uAccent;")
      .replace("#include <dithering_fragment>", `#include <dithering_fragment>
        float dz = (vScanPos.z - uScanZ) * uDir;
        float passed = smoothstep(0.02, -0.02, dz);           // где луч уже прошёл
        vec3 g = abs(fract(vScanPos * 11.0) - 0.5) / fwidth(vScanPos * 11.0);
        float grid = 1.0 - min(min(g.x, g.y), g.z);             // линии сетки, как у 3D-скана
        grid = clamp(grid, 0.0, 1.0);
        float band = exp(-dz * dz * 900.0);                       // сам луч
        vec3 lit = gl_FragColor.rgb * uLit;
        vec3 holo = uAccent * (grid * 0.85 + 0.05) * passed;
        gl_FragColor.rgb = lit + holo * uHolo + uAccent * band * 2.4 * (1.0 - step(98.0, uScanZ));`);
  };
  mat.needsUpdate = true;
}

export function mountCar(canvas, overlay, opts = {}) {
  const accent = new THREE.Color(opts.accent || "#ff3b30");
  SCAN.uAccent.value.copy(accent);
  const frozen = typeof opts.frozenT === "number", reduce = !!opts.reduced;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
  catch (e) { opts.onFail?.(e); return null; }
  let maxDpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 1.6);
  renderer.setPixelRatio(maxDpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const BG = new THREE.Color(opts.bg || "#09090a");
  renderer.setClearColor(BG, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 9, 22);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.02).texture;
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-4, 6, 3); scene.add(key);
  const back = new THREE.DirectionalLight(accent.clone().lerp(new THREE.Color(1, 1, 1), 0.5), 1.4); back.position.set(3, 2, -6); scene.add(back);

  // Пол: глянцевое отражение, поверх тёмная плёнка с кругами стенда и затуханием к краям
  const floorGroup = new THREE.Group(); scene.add(floorGroup);
  let mirror = null;
  if (!opts.noReflection) {
    mirror = new Reflector(new THREE.CircleGeometry(12, 64), { textureWidth: 512, textureHeight: 512, color: 0x8a8a8a, clipBias: 0.003 });
    mirror.rotation.x = -Math.PI / 2; floorGroup.add(mirror);
  }
  const floorMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uBg: { value: BG }, uAccent: { value: accent }, uRing: { value: 0 }, uLit: SCAN.uLit, uAlpha: { value: mirror ? 0.82 : 1 } },
    vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    fragmentShader: `varying vec2 vP; uniform vec3 uBg, uAccent; uniform float uRing, uLit, uAlpha;
      void main(){
        float r = length(vP);
        float fade = smoothstep(2.2, 7.5, r);
        float rings = 0.0;
        for (int i = 1; i <= 3; i++) { float R = 2.6 + float(i) * 0.55; rings += smoothstep(0.012, 0.0, abs(r - R)) * (0.35 / float(i)); }
        float a = mix(uAlpha, 1.0, fade);
        vec3 c = uBg + uAccent * rings * (0.25 + 0.75 * uRing) * (1.0 - fade);
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 96), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; floorGroup.add(floor);
  // мягкая тень под машиной
  const sc = document.createElement("canvas"); sc.width = 256; sc.height = 256; const sg = sc.getContext("2d");
  const gr = sg.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, "rgba(0,0,0,.95)"); gr.addColorStop(0.6, "rgba(0,0,0,.6)"); gr.addColorStop(1, "rgba(0,0,0,0)"); sg.fillStyle = gr; sg.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.004; floorGroup.add(shadow);

  const turn = new THREE.Group(); scene.add(turn);
  const wheels = [];
  let car = null, zMin = -2, zMax = 2.4;

  // Подписи на колёсах (HTML поверх холста)
  const tags = [];
  const mkTag = (cls) => { const el = document.createElement("div"); el.className = "wtag " + cls; el.innerHTML = '<i></i><i></i><i></i><i></i><span></span>'; overlay.appendChild(el); return el; };

  // Несколько адресов модели по очереди (на витрине claude.ai файл .glb отдаётся под другим расширением)
  const urls = [].concat(opts.url || "models/car.glb");
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const tryLoad = (i) => loader.load(urls[i], onLoad, (xhr) => xhr.total && opts.onProgress?.(xhr.loaded / xhr.total), (e) => (i + 1 < urls.length ? tryLoad(i + 1) : opts.onFail?.(e)));
  function onLoad(g) {
    car = g.scene;
    const paint = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(opts.paint || "#1c1f24"), metalness: 0.65, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 });
    const paint2 = new THREE.MeshPhysicalMaterial({ color: 0x0c0d0f, metalness: 0.4, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.08 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x07080a, metalness: 0.2, roughness: 0.03, transparent: true, opacity: 0.62, envMapIntensity: 1.6, side: THREE.DoubleSide });
    const interior = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.7 });
    const caliperMat = new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.35, clearcoat: 1 });
    const mats = new Set();
    car.traverse((o) => {
      if (!o.isMesh) return;
      const n = o.material.name || "";
      if (/^Paint 1/.test(n)) o.material = paint;
      else if (/^Paint 2/.test(n)) o.material = paint2;
      else if (n === "Glass") o.material = glass;
      else if (/^Interior 3/.test(n)) o.material = interior;
      else if (n === "Brake") o.material = caliperMat;
      else if (n === "Headlight") { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0xffffff); o.material.emissiveIntensity = 2.5; }
      else if (n === "Brakelight") { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0xff2a1a); o.material.emissiveIntensity = 2; }
      mats.add(o.material);
    });
    mats.forEach(addScan);
    // центр и пол
    const bb = new THREE.Box3().setFromObject(car), c = bb.getCenter(new THREE.Vector3());
    car.position.x -= c.x; car.position.z -= c.z; car.position.y -= bb.min.y;
    turn.add(car);
    car.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(car); zMin = b2.min.z; zMax = b2.max.z;
    ["WheelFrontL", "WheelRearL", "WheelFrontR", "WheelRearR"].forEach((nm) => { const n = car.getObjectByName(nm); if (n) wheels.push(n); });
    // колесо спереди — с большим z? определяем, чтобы луч шёл от носа к корме
    const front = car.getObjectByName("WheelFrontL"), rear = car.getObjectByName("WheelRearL");
    const fz = front.getWorldPosition(new THREE.Vector3()).z, rz = rear.getWorldPosition(new THREE.Vector3()).z;
    SCAN.uDir.value = fz > rz ? -1 : 1; // луч движется от переда
    // по рамке на каждое колесо: видны только те, что на ближней к зрителю стороне
    ["WheelFrontL", "WheelFrontR"].forEach((nm) => tags.push({ node: car.getObjectByName(nm), el: mkTag("front"), kind: 0 }));
    ["WheelRearL", "WheelRearR"].forEach((nm) => tags.push({ node: car.getObjectByName(nm), el: mkTag("rear"), kind: 1 }));
    api.setTags(opts.tagFront || "R16", opts.tagRear || "≈ 40 МИН");
    resize(); ready = true; startT = now(); opts.onReady?.();
    if (frozen || reduce) frame(frozen ? opts.frozenT : 10);
  }
  tryLoad(0);

  // Размер: машина целиком по ширине (телефон) или высоте (компьютер)
  let W = 1, H = 1, dist = 8;
  function resize() {
    const r = canvas.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix();
    // наименьшее расстояние, при котором углы габарита машины в кадре при любом повороте
    if (car) {
      const bb = new THREE.Box3().setFromObject(car), corners = [];
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) corners.push(new THREE.Vector3(x, y, z));
      const fits = (dd) => {
        const tmp = cam.clone(); tmp.position.set(0, dd * 0.3, dd); tmp.lookAt(0, 0.38, 0); tmp.updateMatrixWorld(); tmp.updateProjectionMatrix();
        for (let a = 0.5; a <= 1.45; a += 0.19) {
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
          for (const c of corners) { const p = c.clone().applyQuaternion(q).project(tmp); if (Math.abs(p.x) > (opts.fitX || 0.96) || p.y > 0.75 || p.y < -0.92) return false; }
        }
        return true;
      };
      let lo = 3, hi = 40; for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
      dist = hi * (opts.zoom || 1);
    }
    mirror?.getRenderTarget().setSize(Math.round(W * 0.5), Math.round(H * 0.5));
  }
  resize();

  // Поворот пальцем: только горизонтальный жест, вертикальный — прокрутка страницы
  let yawDrag = 0, vel = 0, dragging = false, lastX = 0, touched = false;
  canvas.style.touchAction = "pan-y";
  canvas.addEventListener("pointerdown", (e) => { dragging = true; touched = true; lastX = e.clientX; vel = 0; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; vel = dx * 0.008; yawDrag += vel; });
  const up = () => (dragging = false); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);

  const now = () => performance.now() / 1000;
  let ready = false, startT = now(), scanT = -99, raf = 0, visible = true, slow = 0, last = 0;
  const v3 = new THREE.Vector3(), camDir = new THREE.Vector3();
  function frame(T) {
    if (!ready) return;
    const t = reduce ? 10 : T;
    // 0.3-2.3 с: луч от носа к корме, за ним сетка; 2.0-3.3: свет; 3.0+: рамки на колёсах
    const pScan = easeIO(span(t, 0.3, 2.3)), pLit = ease(span(t, 2.0, 3.4)), pTags = ease(span(t, 3.0, 3.6));
    const rs = frozen ? 99 : now() - scanT; // повторный проход луча при смене радиуса
    const pRe = easeIO(span(rs, 0, 1.3));
    const len = zMax - zMin + 0.4;
    const startZ = SCAN.uDir.value > 0 ? zMin - 0.2 : zMax + 0.2;
    let sz = 99, holo = 0;
    if (pScan < 1) { sz = startZ + SCAN.uDir.value * len * pScan; holo = 1 - 0.85 * pLit; }
    else if (rs < 1.6) { sz = startZ + SCAN.uDir.value * len * pRe; holo = Math.sin(Math.PI * clamp(rs / 1.6)) * 0.9; }
    else holo = 0.15 * (1 - pLit);
    SCAN.uScanZ.value = pScan < 1 || rs < 1.3 ? sz : 99;
    SCAN.uHolo.value = holo;
    SCAN.uLit.value = 0.02 + 0.98 * pLit;
    floorMat.uniforms.uRing.value = pScan < 1 ? 1 : 0.35 + 0.65 * Math.max(0, 1 - rs / 1.6) * (rs < 1.6 ? 1 : 0);
    renderer.toneMappingExposure = 0.6 + 0.5 * pLit;
    key.intensity = 0.2 + 2.0 * pLit; back.intensity = 0.6 + 0.8 * pLit;
    if (mirror) mirror.visible = pLit > 0.02;
    // камера: медленный облёт, палец добавляет поворот
    if (!dragging) { vel *= 0.95; yawDrag += vel; }
    const idle = Math.max(0, t - 3.4);
    const yaw = 0.95 + 0.25 * Math.sin(idle * 0.18) + (touched ? 0 : idle * 0.0) + yawDrag - (1 - easeIO(span(t, 0, 3.4))) * 0.5;
    turn.rotation.y = yaw; turn.updateMatrixWorld(); SCAN.uInv.value.copy(turn.matrixWorld).invert();
    const d = dist * (1.12 - 0.12 * easeIO(span(t, 0, 3.4)));
    cam.position.set(0, d * 0.3, d); cam.lookAt(0, 0.38, 0);
    renderer.render(scene, cam);
    // рамки: проекция колёс на экран, видны только колёса на ближней стороне
    cam.getWorldDirection(camDir);
    tags.forEach(({ node, el }) => {
      node.getWorldPosition(v3);
      const toCam = cam.position.clone().sub(v3).normalize();
      const side = v3.clone().setY(0).sub(new THREE.Vector3(0, 0, v3.z).applyQuaternion(new THREE.Quaternion())).normalize();
      const out = new THREE.Vector3(v3.x, 0, v3.z).sub(turn.position);
      const axisX = new THREE.Vector3(1, 0, 0).applyQuaternion(turn.quaternion);
      const facing = Math.sign(out.dot(axisX)) * axisX.dot(toCam);
      const p = v3.clone().project(cam);
      const R = 0.38, edge = v3.clone().add(new THREE.Vector3(0, R, 0)).project(cam);
      const px = (p.x * 0.5 + 0.5) * W, py = (-p.y * 0.5 + 0.5) * H, pr = Math.abs((edge.y - p.y) * 0.5 * H) * 1.12;
      el.style.transform = `translate(${(px - pr).toFixed(1)}px, ${(py - pr).toFixed(1)}px)`;
      el.style.width = el.style.height = `${(pr * 2).toFixed(1)}px`;
      el.style.opacity = (pTags * clamp((facing - 0.05) * 4)).toFixed(3);
    });
  }
  function loop(nowMs) {
    raf = 0; if (!visible || document.hidden) return;
    if (last) { const dt = nowMs - last; slow = dt > 32 ? slow + 1 : Math.max(0, slow - 1); if (slow > 24) { if (maxDpr > 0.9) { maxDpr -= 0.2; renderer.setPixelRatio(maxDpr); resize(); } else if (mirror) { mirror.removeFromParent(); mirror = null; floorMat.uniforms.uAlpha.value = 1; } slow = 0; } }
    last = nowMs; frame(now() - startT); raf = requestAnimationFrame(loop);
  }
  const onResize = () => { resize(); if (frozen || reduce) frame(frozen ? opts.frozenT : 10); };
  window.addEventListener("resize", onResize);
  if (!frozen && !reduce) {
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }).observe(canvas);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && !raf) raf = requestAnimationFrame(loop); });
    raf = requestAnimationFrame(loop);
  }
  const api = {
    rescan() { scanT = now(); },
    setTags(front, rear) { tags.forEach((x) => (x.el.querySelector("span").textContent = x.kind ? rear : front)); if (frozen || reduce) frame(frozen ? opts.frozenT : 10); },
  };
  return api;
}
