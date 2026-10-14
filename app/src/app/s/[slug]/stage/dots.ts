// «Частицы»: шина из нескольких тысяч светящихся точек собирается из облака и медленно вращается.
// Название сервиса выложено точками на боковине. Точки разбегаются от пальца и возвращаются. Только canvas 2D.
import { TAU, ease, runLoop } from "./loop";

export type DotsOpts = { text: string; marks: string; accent: string; font: string; reduced: boolean; frozenT?: number };
export type DotsScene = { destroy(): void };

// kind: 0 протектор, 1 плечи и кольца, 2 надпись, 3 диск, 4 пыль на боковине, 5 пыль вокруг
type Dot = { x: number; y: number; z: number; kind: number; sx: number; sy: number; sz: number; d: number; ox: number; oy: number; vx: number; vy: number };

const hex = (c: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  const n = m ? parseInt(m[1], 16) : 0x7c5cff;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function mountDots(cv: HTMLCanvasElement, o: DotsOpts): DotsScene | null {
  const g = cv.getContext("2d");
  if (!g) return null;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const P: Dot[] = [];
  // начало: облако в круге вокруг шины (а не в прямоугольнике холста), края гасит маска в стилях
  const add = (x: number, y: number, z: number, kind: number) => {
    const a = Math.random() * TAU, r = 0.4 + 2.4 * Math.sqrt(Math.random());
    P.push({ x, y, z, kind, sx: Math.cos(a) * r, sy: Math.sin(a) * r * 0.8, sz: (Math.random() - 0.5) * 3, d: Math.random() * 0.6, ox: 0, oy: 0, vx: 0, vy: 0 });
  };

  // протектор: точки на беговой дорожке, кроме канавок
  const N = 60, nA = small ? 170 : 240;
  for (let i = 0; i < nA; i++) for (let j = 0; j < 12; j++) {
    const a = (i / nA) * TAU, z = -0.19 + (j / 11) * 0.38, az = Math.abs(z);
    const sh = (a * N) / TAU + az * 6 + (az > 0.07 ? 0.5 : 0);
    if (0.5 - Math.abs((sh % 1) - 0.5) < 0.16 || Math.abs(az - 0.07) < 0.018) continue;
    add(Math.cos(a), Math.sin(a), z, 0);
  }
  for (let i = 0; i < nA; i++) for (const sgn of [-1, 1]) for (let k = 1; k <= 3; k++) {
    const a = (i / nA) * TAU + k * 0.01, t = k / 4, r = 1 - 0.1 * t * t;
    add(Math.cos(a) * r, Math.sin(a) * r, sgn * (0.2 + 0.03 * Math.sin((t * Math.PI) / 2)), 1);
  }
  const ringN = small ? 90 : 130;
  for (const R of [0.63, 0.92]) for (let i = 0; i < ringN; i++) { const a = (i / ringN) * TAU; add(Math.cos(a) * R, Math.sin(a) * R, 0.215, 1); }
  for (let i = 0; i < (small ? 600 : 900); i++) { const a = Math.random() * TAU, r = 0.64 + Math.random() * 0.3; add(Math.cos(a) * r, Math.sin(a) * r, Math.random() < 0.6 ? 0.215 : -0.215, 4); }
  for (let i = 0; i < (small ? 120 : 220); i++) { const a = Math.random() * TAU, r = 1.15 + Math.random() * 0.9; add(Math.cos(a) * r, Math.sin(a) * r, (Math.random() - 0.5) * 1.6, 5); }
  // диск: обод, ступица и пять спиц
  for (let i = 0; i < 110; i++) { const a = (i / 110) * TAU; add(Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.17, 3); add(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.05, 3); }
  for (let s = 0; s < 5; s++) for (let k = 0; k < 26; k++) for (const off of [-1, 1]) {
    const r = 0.17 + (k / 25) * 0.41, w = (0.06 - 0.025 * (k / 25)) * off, a0 = (s / 5) * TAU, z = 0.04 + 0.11 * Math.min(1, Math.max(0, (r - 0.12) / 0.44));
    add(Math.cos(a0) * r - Math.sin(a0) * w, Math.sin(a0) * r + Math.cos(a0) * w, z, 3);
  }
  // надпись по кругу боковины: рисуем буквы на холсте и берём точки, где они есть
  const textDots = () => {
    const S = 300, T = document.createElement("canvas");
    T.width = T.height = S;
    const tg = T.getContext("2d")!;
    tg.translate(S / 2, S / 2);
    tg.fillStyle = "#fff";
    tg.textAlign = "center";
    tg.textBaseline = "middle";
    const ring = (str: string, size: number, R: number, bottom: boolean) => {
      const chars = [...str];
      const measure = (sz: number) => { tg.font = `800 ${sz}px ${o.font}, sans-serif`; return chars.map((c) => tg.measureText(c).width + sz * 0.08); };
      let ws = measure(size), tot = ws.reduce((a, b) => a + b, 0);
      const max = Math.PI * R * 0.92; // не больше половины окружности
      if (tot > max) { size = Math.max(9, Math.floor((size * max) / tot)); ws = measure(size); tot = ws.reduce((a, b) => a + b, 0); }
      let ang = bottom ? tot / R / 2 : -tot / R / 2;
      chars.forEach((c, i) => {
        const d = ws[i] / R, mid = bottom ? ang - d / 2 : ang + d / 2;
        tg.save(); tg.rotate(mid); tg.translate(0, bottom ? R : -R); tg.fillText(c, 0, 0); tg.restore();
        ang += bottom ? -d : d;
      });
    };
    ring(o.text, 19, (0.77 * S) / 2, false);
    ring(o.marks, 13, (0.8 * S) / 2, true);
    const im = tg.getImageData(0, 0, S, S).data;
    for (let y = 0; y < S; y += 2) for (let x = 0; x < S; x += 2) if (im[(y * S + x) * 4 + 3] > 128) add((x / S - 0.5) * 2, -(y / S - 0.5) * 2, 0.215, 2);
  };

  const A = hex(o.accent), B: [number, number, number] = [255, 184, 41];
  // центр шины по ширине холста: из --cx в стилях (на компьютере холст на весь первый экран, шина справа)
  let W = 0, H = 0, dpr = 1, maxDpr = 1.5, cx = 0.56;
  const fit = () => { const r = cv.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, maxDpr); cx = parseFloat(getComputedStyle(cv).getPropertyValue("--cx")) || 0.56; W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); };
  fit();
  let px = -1e4, py = -1e4;
  const host = cv.parentElement ?? cv;
  const move = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top; };
  const leave = () => { px = py = -1e4; };
  host.addEventListener("pointermove", move);
  host.addEventListener("pointerleave", leave);
  host.addEventListener("pointerup", leave);

  const frame = (t: number) => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = "lighter";
    const yaw = 0.62 + 0.16 * Math.sin(t * 0.22), pitch = -0.14, spin = t * 0.09;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cs = Math.cos(spin), ss = Math.sin(spin);
    const scale = Math.min(W, H) * (W > 700 ? 0.42 : 0.4), cx0 = W * cx, cy0 = H * 0.5;
    for (const p of P) {
      const k = o.reduced ? 1 : ease((t - p.d) / 2.2);
      let x = p.x * cs - p.y * ss, y = p.x * ss + p.y * cs, z = p.z;
      x = p.sx + (x - p.sx) * k;
      y = p.sy + (y - p.sy) * k;
      z = p.sz + (z - p.sz) * k;
      const X = x * cy + z * sy, Z0 = -x * sy + z * cy, Y = y * cp - Z0 * sp, Z = y * sp + Z0 * cp;
      const f = 3.2 / (3.2 - Z), sx = cx0 + X * scale * f, syy = cy0 - Y * scale * f;
      const dx = sx - px, dy = syy - py, d2 = dx * dx + dy * dy;
      if (d2 < 6400) { const q = (1 - d2 / 6400) * 2.2, inv = 1 / Math.sqrt(d2 + 1); p.vx += dx * inv * q; p.vy += dy * inv * q; }
      p.vx = (p.vx - p.ox * 0.06) * 0.86;
      p.vy = (p.vy - p.oy * 0.06) * 0.86;
      p.ox += p.vx;
      p.oy += p.vy;
      let a = (0.25 + 0.75 * ((Z + 1.2) / 2.4)) * (0.35 + 0.65 * k);
      if (p.kind === 2) a = Math.min(1, a * 1.6);
      else if (p.kind === 4) a *= 0.35;
      else if (p.kind === 5) a *= 0.3 + 0.3 * Math.sin(t * 1.3 + p.d * 20);
      let c: [number, number, number];
      if (p.kind === 2) c = [255, 240, 214];
      else if (p.kind === 3) c = [210, 205, 255];
      else if (p.kind === 4) c = A;
      else if (p.kind === 5) c = [255, 200, 120];
      else { const m = Math.pow(0.5 + 0.5 * Math.sin(Math.atan2(p.y, p.x) + t * 0.4), 2); c = [A[0] + (B[0] - A[0]) * m, A[1] + (B[1] - A[1]) * m, A[2] + (B[2] - A[2]) * m]; }
      g.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
      const s = (p.kind === 2 ? 1.5 : 1.7) * f;
      g.fillRect(sx + p.ox - s / 2, syy + p.oy - s / 2, s, s);
    }
  };

  const still = o.reduced || o.frozenT !== undefined;
  const stillT = o.frozenT ?? 0;
  const onResize = () => { fit(); if (still) frame(stillT); };
  window.addEventListener("resize", onResize);
  textDots();
  const stop = still ? (frame(stillT), () => {}) : runLoop(cv, frame, () => { maxDpr = Math.max(0.75, maxDpr - 0.25); fit(); });
  return {
    destroy() {
      stop();
      window.removeEventListener("resize", onResize);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
      host.removeEventListener("pointerup", leave);
    },
  };
}
