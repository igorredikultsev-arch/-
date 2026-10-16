// Общее для 3D-сцен первого экрана: плавности, цикл кадров и поворот пальцем.

export const TAU = Math.PI * 2;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
export const easeIO = (x: number) => {
  x = clamp(x);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
/** С лёгким перелётом в конце: деталь «садится» на место. */
export const settle = (x: number) => {
  x = clamp(x);
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
export const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const sstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Цикл кадров: стоит, пока сцена вне экрана или вкладка в фоне; если кадры подолгу медленнее 30 мс,
 * зовёт onSlow (сцена снижает чёткость, потом выключает отражения). Возвращает функцию остановки.
 */
export function runLoop(el: Element, frame: (t: number) => void, onSlow: () => void): () => void {
  let raf = 0, visible = true, slow = 0, last = 0, stopped = false;
  const t0 = performance.now();
  const tick = (now: number) => {
    raf = 0;
    if (stopped || !visible || document.hidden) return;
    if (last) {
      slow = now - last > 30 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 24) { onSlow(); slow = 0; }
    }
    last = now;
    frame((now - t0) / 1000);
    raf = requestAnimationFrame(tick);
  };
  const wake = () => { if (!raf && !stopped && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); } };
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; wake(); });
  io.observe(el);
  document.addEventListener("visibilitychange", wake);
  wake();
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    io.disconnect();
    document.removeEventListener("visibilitychange", wake);
  };
}

/** Поворот сцены горизонтальным жестом с инерцией; вертикальный жест остаётся прокрутке страницы. */
export function dragYaw(el: HTMLElement, k: number) {
  const s = { yaw: 0, vel: 0, dragging: false };
  let lastX = 0;
  el.style.touchAction = "pan-y";
  const down = (e: PointerEvent) => { s.dragging = true; lastX = e.clientX; s.vel = 0; el.setPointerCapture?.(e.pointerId); };
  const move = (e: PointerEvent) => { if (!s.dragging) return; s.vel = (e.clientX - lastX) * k; lastX = e.clientX; s.yaw += s.vel; };
  const up = () => { s.dragging = false; };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  return {
    s,
    /** Шаг инерции после отпускания; drift < 1 медленно возвращает к исходному повороту. */
    step(drift = 1) { if (!s.dragging) { s.vel *= 0.94; s.yaw += s.vel; s.yaw *= drift; } },
    off() { el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); },
  };
}
