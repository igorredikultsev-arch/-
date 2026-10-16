"use client";

import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import type { RadiusPick } from "../events";
import { accentOf, bgOf, frozenAt, labels, reducedMotion, useRadius } from "./shared";

const MODEL = "/3d/car.glb";
// Код сцены начинает грузиться сразу, как браузер получил этот файл, не дожидаясь отрисовки страницы
const engine = typeof window === "undefined" ? null : import("./car");

/** «Сканер»: 3D-машина на стенде. Пока грузится модель — затемнённая картинка той же сцены. */
export function CarStage({ initial }: { initial: RadiusPick | null }) {
  // модель качается с самого начала загрузки страницы, параллельно с остальным
  preload(MODEL, { as: "fetch", crossOrigin: "anonymous" });
  const cv = useRef<HTMLCanvasElement>(null);
  const ov = useRef<HTMLDivElement>(null);
  const radius = useRadius(initial);
  const scene = useRef<{ rescan(): void; setTags(f: string, r: string): void } | null>(null);
  const [ready, setReady] = useState(false);
  const pick = radius.current;

  useEffect(() => {
    let dead = false, destroy = () => {};
    (async () => {
      const { mountCar } = await engine!;
      if (dead || !cv.current || !ov.current) return;
      const [front, rear] = labels(radius.current);
      const s = mountCar(cv.current, ov.current, {
        url: MODEL, accent: accentOf(cv.current), bg: bgOf(cv.current), front, rear,
        reduced: reducedMotion(), frozenT: frozenAt(), onReady: () => !dead && setReady(true), onFail: () => {},
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
      <canvas ref={cv} role="img" aria-label="Машина в 3D, её можно покрутить" />
      <picture>
        <source media="(min-width: 960px)" srcSet="/3d/car-d.webp" />
        {/* eslint-disable-next-line @next/next/no-img-element -- картинка-заглушка, пока грузится 3D-модель */}
        <img className={`poster${ready ? " off" : ""}`} src="/3d/car-m.webp" alt="" aria-hidden="true" />
      </picture>
      <div className="tags" ref={ov} aria-hidden="true" />
    </>
  );
}
