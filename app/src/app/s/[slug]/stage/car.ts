// «Сканер»: 3D-машина на диагностическом стенде. Луч проходит от носа к корме, за ним остаётся сетка 3D-скана,
// потом зажигается студийный свет; рамки с радиусом и временем держатся на колёсах. Машину можно крутить.
// Модель — концепт-кар без марки (Khronos glTF Sample Assets «Car Concept», CC BY 4.0, логотипы убраны), public/3d/car.glb.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { clamp, dragYaw, ease, easeIO, runLoop, span } from "./loop";

export type CarOpts = { url: string; accent: string; bg: string; front: string; rear: string; reduced: boolean; frozenT?: number; onReady(): void; onFail(): void };
export type CarScene = { rescan(): void; setTags(front: string, rear: string): void; destroy(): void };

export function mountCar(canvas: HTMLCanvasElement, overlay: HTMLElement, o: CarOpts): CarScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  const accent = new THREE.Color(o.accent), BG = new THREE.Color(o.bg);
  // Общие для всех материалов машины параметры скана
  const SCAN = { uInv: { value: new THREE.Matrix4() }, uScanZ: { value: 99 }, uBand: { value: 0 }, uHolo: { value: 0 }, uLit: { value: 0 }, uAccent: { value: accent }, uDir: { value: 1 } };
  const addScan = (mat: THREE.Material) => {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, SCAN);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vScanPos;\nuniform mat4 uInv;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvScanPos = (uInv * modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vScanPos;\nuniform float uScanZ, uBand, uHolo, uLit, uDir;\nuniform vec3 uAccent;")
        .replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
          float dz = (vScanPos.z - uScanZ) * uDir;
          float passed = smoothstep(0.02, -0.02, dz);
          vec3 gq = abs(fract(vScanPos * 11.0) - 0.5) / fwidth(vScanPos * 11.0);
          float grid = clamp(1.0 - min(min(gq.x, gq.y), gq.z), 0.0, 1.0);
          float band = exp(-dz * dz * 900.0);
          gl_FragColor.rgb = gl_FragColor.rgb * uLit + uAccent * (grid * 0.85 + 0.05) * passed * uHolo + uAccent * band * 2.4 * uBand;`,
        );
    };
    mat.needsUpdate = true;
  };

  let dpr = Math.min(window.devicePixelRatio || 1, 1.6);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(BG, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 9, 22);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.02).texture;
  pm.dispose();
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-4, 6, 3);
  const back = new THREE.DirectionalLight(accent.clone().lerp(new THREE.Color(1, 1, 1), 0.5), 1.4);
  back.position.set(3, 2, -6);
  scene.add(key, back);

  // Пол стенда: глянцевое отражение, поверх тёмная плёнка с кругами и затуханием к краям, мягкая тень
  let mirror: Reflector | null = new Reflector(new THREE.CircleGeometry(12, 64), { textureWidth: 512, textureHeight: 512, color: 0x8a8a8a, clipBias: 0.003 });
  mirror.rotation.x = -Math.PI / 2;
  scene.add(mirror);
  const floorMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uBg: { value: BG }, uAccent: { value: accent }, uRing: { value: 0 }, uAlpha: { value: 0.82 } },
    vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    fragmentShader: `varying vec2 vP; uniform vec3 uBg, uAccent; uniform float uRing, uAlpha;
      void main(){
        float r = length(vP), fade = smoothstep(2.2, 7.5, r), rings = 0.0;
        for (int i = 1; i <= 3; i++) { float R = 2.6 + float(i) * 0.55; rings += smoothstep(0.012, 0.0, abs(r - R)) * (0.35 / float(i)); }
        gl_FragColor = vec4(uBg + uAccent * rings * (0.25 + 0.75 * uRing) * (1.0 - fade), mix(uAlpha, 1.0, fade));
        #include <colorspace_fragment>
      }`,
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 96), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.002;
  const sc = document.createElement("canvas");
  sc.width = sc.height = 256;
  const sg = sc.getContext("2d")!;
  const gr = sg.createRadialGradient(128, 128, 10, 128, 128, 128);
  gr.addColorStop(0, "rgba(0,0,0,.95)");
  gr.addColorStop(0.6, "rgba(0,0,0,.6)");
  gr.addColorStop(1, "rgba(0,0,0,0)");
  sg.fillStyle = gr;
  sg.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  scene.add(floor, shadow);

  const turn = new THREE.Group();
  scene.add(turn);
  let car: THREE.Object3D | null = null, zMin = -2, zMax = 2.4;
  const tags: { node: THREE.Object3D; el: HTMLElement; rear: boolean }[] = [];
  let labels = [o.front, o.rear];
  const mkTag = () => {
    const el = document.createElement("div");
    el.className = "wtag";
    el.innerHTML = "<i></i><i></i><i></i><i></i><span></span>";
    overlay.appendChild(el);
    return el;
  };
  const writeTags = () => tags.forEach((x) => (x.el.querySelector("span")!.textContent = x.rear ? labels[1] : labels[0]));

  let dead = false, ready = false, startT = 0, scanT = -99;
  const now = () => performance.now() / 1000;
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(
    o.url,
    (gltf) => {
      if (dead) return;
      car = gltf.scene;
      const paint = new THREE.MeshPhysicalMaterial({ color: 0x1c1f24, metalness: 0.65, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 });
      const paint2 = new THREE.MeshPhysicalMaterial({ color: 0x0c0d0f, metalness: 0.4, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.08 });
      const glass = new THREE.MeshPhysicalMaterial({ color: 0x07080a, metalness: 0.2, roughness: 0.03, transparent: true, opacity: 0.62, envMapIntensity: 1.6, side: THREE.DoubleSide });
      const interior = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.7 });
      const caliper = new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.35, clearcoat: 1 });
      const mats = new Set<THREE.Material>();
      car.traverse((x) => {
        if (!(x instanceof THREE.Mesh)) return;
        const m = x.material as THREE.MeshStandardMaterial, n = m.name || "";
        if (/^Paint 1/.test(n)) x.material = paint;
        else if (/^Paint 2/.test(n)) x.material = paint2;
        else if (n === "Glass") x.material = glass;
        else if (/^Interior 3/.test(n)) x.material = interior;
        else if (n === "Brake") x.material = caliper;
        else if (n === "Headlight" || n === "Brakelight") {
          const lamp = m.clone();
          lamp.emissive = new THREE.Color(n === "Headlight" ? 0xffffff : 0xff2a1a);
          lamp.emissiveIntensity = n === "Headlight" ? 2.5 : 2;
          x.material = lamp;
        }
        mats.add(x.material as THREE.Material);
      });
      mats.forEach(addScan);
      const bb = new THREE.Box3().setFromObject(car), c = bb.getCenter(new THREE.Vector3());
      car.position.set(-c.x, -bb.min.y, -c.z);
      turn.add(car);
      car.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(car);
      zMin = b2.min.z;
      zMax = b2.max.z;
      const node = (n: string) => car!.getObjectByName(n)!;
      // луч идёт от носа к корме
      SCAN.uDir.value = node("WheelFrontL").getWorldPosition(new THREE.Vector3()).z > node("WheelRearL").getWorldPosition(new THREE.Vector3()).z ? -1 : 1;
      for (const n of ["WheelFrontL", "WheelFrontR"]) tags.push({ node: node(n), el: mkTag(), rear: false });
      for (const n of ["WheelRearL", "WheelRearR"]) tags.push({ node: node(n), el: mkTag(), rear: true });
      writeTags();
      resize();
      // шейдеры собираются в фоне, страница не замирает; скан начинается после этого
      renderer.compileAsync(scene, cam).catch(() => undefined).then(() => {
        if (dead) return;
        ready = true;
        startT = now();
        o.onReady();
        if (still) frame(stillT);
      });
    },
    undefined,
    () => { if (!dead) o.onFail(); },
  );

  // Расстояние камеры: наименьшее, при котором машина целиком в кадре на обычных углах обзора
  let W = 1, H = 1, dist = 8;
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
    mirror?.getRenderTarget().setSize(Math.round(W * dpr * 0.5), Math.round(H * dpr * 0.5));
    if (!car) return;
    const bb = new THREE.Box3().setFromObject(car), corners: THREE.Vector3[] = [];
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) corners.push(new THREE.Vector3(x, y, z));
    const tmp = cam.clone(), axis = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), p = new THREE.Vector3();
    const fits = (dd: number) => {
      tmp.position.set(0, dd * 0.3, dd);
      tmp.lookAt(0, 0.38, 0);
      tmp.updateMatrixWorld();
      for (let a = 0.5; a <= 1.45; a += 0.19) {
        q.setFromAxisAngle(axis, a);
        for (const c of corners) { p.copy(c).applyQuaternion(q).project(tmp); if (Math.abs(p.x) > 0.96 || p.y > 0.75 || p.y < -0.92) return false; }
      }
      return true;
    };
    let lo = 3, hi = 40;
    for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    dist = hi;
  }
  resize();
  const drag = dragYaw(canvas, 0.008);

  const v3 = new THREE.Vector3(), up = new THREE.Vector3(), axisX = new THREE.Vector3(), out = new THREE.Vector3(), toCam = new THREE.Vector3(), p = new THREE.Vector3();
  function frame(t: number) {
    if (!ready) return;
    // 0.3-2.3 с: луч от носа к корме, за ним сетка; 1.8-2.9: свет (сетка гаснет 2.0-3.1); 3.0+: рамки на колёсах
    const pScan = easeIO(span(t, 0.3, 2.3)), pLit = ease(span(t, 1.8, 2.9)), pTags = ease(span(t, 3.0, 3.6));
    // сетка скана гаснет плавно, пока зажигается свет: переходы накладываются, яркость не проваливается
    const grid = 1 - easeIO(span(t, 2.0, 3.1));
    const rs = o.frozenT !== undefined ? 99 : now() - scanT; // повторный проход при смене радиуса
    const len = zMax - zMin + 0.4, dir = SCAN.uDir.value, startZ = dir > 0 ? zMin - 0.2 : zMax + 0.2;
    const again = rs < 1.6 ? Math.sin(Math.PI * clamp(rs / 1.6)) : 0;
    // когда луч не идёт, он стоит за кормой: вся машина считается пройденной, сетка не пропадает разом
    let sz = startZ + dir * len, band = 0;
    if (pScan < 1) { sz = startZ + dir * len * pScan; band = 1; }
    else if (rs < 1.3) { sz = startZ + dir * len * easeIO(rs / 1.3); band = 1; }
    const holo = Math.max(grid, again * 0.9);
    SCAN.uScanZ.value = sz;
    SCAN.uBand.value = band;
    SCAN.uHolo.value = holo;
    SCAN.uLit.value = 0.02 + 0.98 * pLit;
    floorMat.uniforms.uRing.value = 0.35 + 0.65 * Math.max(grid, again);
    renderer.toneMappingExposure = 0.6 + 0.5 * pLit;
    key.intensity = 0.2 + 2.0 * pLit;
    back.intensity = 0.6 + 0.8 * pLit;
    if (mirror) mirror.visible = pLit > 0.02;
    drag.step();
    const intro = easeIO(span(t, 0, 3.4)), idle = Math.max(0, t - 3.4);
    turn.rotation.y = 0.95 + 0.25 * Math.sin(idle * 0.18) + drag.s.yaw - (1 - intro) * 0.5;
    turn.updateMatrixWorld();
    SCAN.uInv.value.copy(turn.matrixWorld).invert();
    const d = dist * (1.12 - 0.12 * intro);
    cam.position.set(0, d * 0.3, d);
    cam.lookAt(0, 0.38, 0);
    renderer.render(scene, cam);
    // рамки: колесо проецируется на экран; видны только колёса ближней к зрителю стороны
    axisX.set(1, 0, 0).applyQuaternion(turn.quaternion);
    for (const { node, el } of tags) {
      node.getWorldPosition(v3);
      toCam.copy(cam.position).sub(v3).normalize();
      out.set(v3.x, 0, v3.z);
      const facing = Math.sign(out.dot(axisX)) * axisX.dot(toCam);
      p.copy(v3).project(cam);
      up.copy(v3).setY(v3.y + 0.38).project(cam);
      const px = (p.x * 0.5 + 0.5) * W, py = (-p.y * 0.5 + 0.5) * H, pr = Math.abs((up.y - p.y) * 0.5 * H) * 1.12;
      el.style.transform = `translate(${(px - pr).toFixed(1)}px, ${(py - pr).toFixed(1)}px)`;
      el.style.width = el.style.height = `${(pr * 2).toFixed(1)}px`;
      el.style.opacity = (pTags * clamp((facing - 0.05) * 4)).toFixed(3);
    }
  }

  const still = o.reduced || o.frozenT !== undefined;
  const stillT = o.frozenT ?? 10;
  const onResize = () => { resize(); if (still) frame(stillT); };
  window.addEventListener("resize", onResize);
  const stop = still
    ? () => {}
    : runLoop(canvas, () => frame(now() - startT), () => {
        if (dpr > 0.9) { dpr -= 0.2; renderer.setPixelRatio(dpr); resize(); }
        else if (mirror) { scene.remove(mirror); mirror.dispose(); mirror = null; floorMat.uniforms.uAlpha.value = 1; }
      });

  return {
    rescan() { scanT = now(); },
    setTags(front, rear) { labels = [front, rear]; writeTags(); if (still) frame(stillT); },
    destroy() {
      dead = true;
      stop();
      drag.off();
      window.removeEventListener("resize", onResize);
      tags.forEach((x) => x.el.remove());
      scene.traverse((x) => { if (x instanceof THREE.Mesh) { x.geometry.dispose(); [x.material].flat().forEach((m: THREE.Material) => m.dispose()); } });
      mirror?.dispose();
      renderer.dispose();
    },
  };
}
