// Общее для 3D-сцен первого экрана: подписи, цвет сайта, выбранный радиус, ?frame= для снимков.
import { useEffect, useRef, useState } from "react";
import { RADIUS_EVENT, type RadiusPick } from "../events";

/** Размер шины для надписи на боковине по радиусу. */
const TIRE_SIZE: Record<number, string> = { 13: "175/70", 14: "185/65", 15: "195/65", 16: "205/55", 17: "225/45", 18: "235/40", 19: "245/40", 20: "255/35", 21: "265/35", 22: "275/35" };
export const tireMarks = (r: number | null) => (r == null ? "ОНЛАЙН-ЗАПИСЬ" : `${TIRE_SIZE[r] ?? ""} R${r}`.trim());
const minutesTag = (m: number) => (m >= 60 && m % 60 === 0 ? `≈ ${m / 60} Ч` : `≈ ${m} МИН`);
/** Подписи рамок на колёсах машины: спереди радиус, сзади время. */
export const labels = (p: RadiusPick | null): [string, string] => (p ? [`R${p.r} · 4 КОЛЕСА`, minutesTag(p.minutes)] : ["4 КОЛЕСА", "ОНЛАЙН-ЗАПИСЬ"]);

// Шрифт надписей на шине (Unbounded из fontsource, подключён в каркасе сайта)
export const FONT = '"Unbounded Variable"';

export const accentOf = (el: Element) => getComputedStyle(el).getPropertyValue("--accent").trim() || "#2f7bff";
export const bgOf = (el: Element) => getComputedStyle(el).getPropertyValue("--s-bg").trim() || "#060607";
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** ?frame=2.5 в адресе останавливает сцену на этой секунде: так снимаются кадры анимации для проверки. */
export const frozenAt = () => {
  const v = parseFloat(new URLSearchParams(location.search).get("frame") ?? "");
  return Number.isFinite(v) ? v : undefined;
};
export const fontReady = () => (document.fonts ? document.fonts.load(`800 40px ${FONT}`).then(() => undefined, () => undefined) : Promise.resolve());

/** Последний выбранный радиус: сцена может загрузиться позже, чем его выберут. */
export function useRadius(initial: RadiusPick | null) {
  const ref = useRef(initial);
  const [, bump] = useState(0);
  useEffect(() => {
    const on = (e: Event) => { ref.current = (e as CustomEvent<RadiusPick>).detail; bump((n) => n + 1); };
    window.addEventListener(RADIUS_EVENT, on);
    return () => window.removeEventListener(RADIUS_EVENT, on);
  }, []);
  return ref;
}

