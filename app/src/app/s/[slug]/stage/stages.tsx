"use client";

import { useEffect, useRef, useState } from "react";
import { RADIUS_EVENT, type RadiusPick } from "../events";

// 3D-сцены первого экрана для стилей «Колесо», «Сканер», «Частицы». Код сцен (three.js) грузится отдельно,
// после показа страницы, поэтому запись и текст доступны сразу. Цвет берётся из --accent сайта.

/** Размер шины для надписи на боковине по радиусу. */
const TIRE_SIZE: Record<number, string> = { 13: "175/70", 14: "185/65", 15: "195/65", 16: "205/55", 17: "225/45", 18: "235/40", 19: "245/40", 20: "255/35", 21: "265/35", 22: "275/35" };
export const tireMarks = (r: number | null) => (r == null ? "ОНЛАЙН-ЗАПИСЬ" : `${TIRE_SIZE[r] ?? ""} R${r}`.trim());
const minutesTag = (m: number) => (m >= 60 && m % 60 === 0 ? `≈ ${m / 60} Ч` : `≈ ${m} МИН`);
/** Подписи рамок на колёсах машины: спереди радиус, сзади время. */
const labels = (p: RadiusPick | null): [string, string] => (p ? [`R${p.r} · 4 КОЛЕСА`, minutesTag(p.minutes)] : ["4 КОЛЕСА", "ОНЛАЙН-ЗАПИСЬ"]);

// Шрифт надписей на шине (Unbounded из fontsource, подключён в каркасе сайта)
const FONT = '"Unbounded Variable"';

const accentOf = (el: Element) => getComputedStyle(el).getPropertyValue("--accent").trim() || "#2f7bff";
const bgOf = (el: Element) => getComputedStyle(el).getPropertyValue("--s-bg").trim() || "#060607";
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** ?frame=2.5 в адресе останавливает сцену на этой секунде: так снимаются кадры анимации для проверки. */
const frozenAt = () => {
  const v = parseFloat(new URLSearchParams(location.search).get("frame") ?? "");
  return Number.isFinite(v) ? v : undefined;
};
const fontReady = () => (document.fonts ? document.fonts.load(`800 40px ${FONT}`).then(() => undefined, () => undefined) : Promise.resolve());

/** Последний выбранный радиус: сцена может загрузиться позже, чем его выберут. */
function useRadius(initial: RadiusPick | null) {
  const ref = useRef(initial);
  const [, bump] = useState(0);
  useEffect(() => {
    const on = (e: Event) => { ref.current = (e as CustomEvent<RadiusPick>).detail; bump((n) => n + 1); };
    window.addEventListener(RADIUS_EVENT, on);
    return () => window.removeEventListener(RADIUS_EVENT, on);
  }, []);
  return ref;
}

export function WheelStage({ text, initial, fallback }: { text: string; initial: RadiusPick | null; fallback: React.ReactNode }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const radius = useRadius(initial);
  const scene = useRef<{ setMarks(m: string): void } | null>(null);
  const [failed, setFailed] = useState(false);
  const r = radius.current?.r ?? null;

  useEffect(() => {
    let dead = false, destroy = () => {};
    (async () => {
      const [{ mountWheel }] = await Promise.all([import("./wheel"), fontReady()]);
      if (dead || !cv.current) return;
      const s = mountWheel(cv.current, { text, marks: tireMarks(radius.current?.r ?? null), accent: accentOf(cv.current), bg: bgOf(cv.current), font: FONT, reduced: reducedMotion(), frozenT: frozenAt() });
      if (!s) return setFailed(true);
      scene.current = s;
      destroy = () => s.destroy();
    })().catch(() => setFailed(true));
    return () => { dead = true; scene.current = null; destroy(); };
  }, [text, radius]);

  useEffect(() => { scene.current?.setMarks(tireMarks(r)); }, [r]);

  return failed ? <>{fallback}</> : <canvas ref={cv} role="img" aria-label="Колесо в 3D, его можно покрутить" />;
}

export function CarStage({ initial, poster }: { initial: RadiusPick | null; poster: { mobile: string; desktop: string } }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const ov = useRef<HTMLDivElement>(null);
  const radius = useRadius(initial);
  const scene = useRef<{ rescan(): void; setTags(f: string, r: string): void } | null>(null);
  const [ready, setReady] = useState(false);
  const pick = radius.current;

  useEffect(() => {
    let dead = false, destroy = () => {};
    (async () => {
      const { mountCar } = await import("./car");
      if (dead || !cv.current || !ov.current) return;
      const [front, rear] = labels(radius.current);
      const s = mountCar(cv.current, ov.current, {
        url: "/3d/car.glb", accent: accentOf(cv.current), bg: bgOf(cv.current),
        front, rear, reduced: reducedMotion(), frozenT: frozenAt(), onReady: () => setReady(true), onFail: () => {},
      });
      if (!s) return;
      scene.current = s;
      destroy = () => s.destroy();
    })().catch(() => {});
    return () => { dead = true; scene.current = null; destroy(); };
  }, [radius]);

  // Другой радиус: новые подписи и ещё один проход луча
  const shownR = useRef(initial?.r ?? null);
  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    s.setTags(...labels(pick));
    if ((pick?.r ?? null) !== shownR.current) s.rescan();
    shownR.current = pick?.r ?? null;
  }, [pick]);

  return (
    <>
      <picture>
        <source media="(min-width: 960px)" srcSet={poster.desktop} />
        {/* eslint-disable-next-line @next/next/no-img-element -- картинка-заглушка, пока грузится 3D-модель */}
        <img className={`poster${ready ? " off" : ""}`} src={poster.mobile} alt="" aria-hidden="true" />
      </picture>
      <canvas ref={cv} role="img" aria-label="Машина в 3D, её можно покрутить" />
      <div className="tags" ref={ov} aria-hidden="true" />
    </>
  );
}

export function DotsStage({ text, marks }: { text: string; marks: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let dead = false, destroy = () => {};
    (async () => {
      const [{ mountDots }] = await Promise.all([import("./dots"), fontReady()]);
      if (dead || !cv.current) return;
      const s = mountDots(cv.current, { text, marks, accent: accentOf(cv.current), font: FONT, reduced: reducedMotion(), frozenT: frozenAt() });
      if (s) destroy = () => s.destroy();
    })().catch(() => {});
    return () => { dead = true; destroy(); };
  }, [text, marks]);
  return <canvas ref={cv} role="img" aria-label="Шина из светящихся точек" />;
}
