"use client";

import { useEffect, useRef, useState } from "react";
import type { RadiusPick } from "../events";
import { accentOf, bgOf, FONT, fontReady, frozenAt, reducedMotion, tireMarks, useRadius } from "./shared";

// Код сцены начинает грузиться сразу, как браузер получил этот файл, не дожидаясь отрисовки страницы
const engine = typeof window === "undefined" ? null : import("./wheel");
/** С этой секунды анимации начинается сцена: до неё на месте сцены стоит картинка того же кадра. */
const START = 0.35;

/** «Колесо»: 3D-колесо собирается из деталей. Пока грузится — картинка первого кадра, без WebGL — плоская шина. */
export function WheelStage({ text, initial, fallback }: { text: string; initial: RadiusPick | null; fallback: React.ReactNode }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const radius = useRadius(initial);
  const scene = useRef<{ setMarks(m: string): void } | null>(null);
  const [state, setState] = useState<"wait" | "live" | "failed">("wait");
  const r = radius.current?.r ?? null;

  useEffect(() => {
    let dead = false, destroy = () => {};
    (async () => {
      const { mountWheel } = await engine!;
      if (dead || !cv.current) return;
      const s = mountWheel(cv.current, {
        text, marks: tireMarks(radius.current?.r ?? null), accent: accentOf(cv.current), bg: bgOf(cv.current), font: FONT,
        reduced: reducedMotion(), frozenT: frozenAt(), startAt: START, onReady: () => !dead && setState("live"),
      });
      if (!s) return setState("failed");
      scene.current = s;
      destroy = () => s.destroy();
      // название на шине перерисуется фирменным шрифтом, когда он догрузится (сцену шрифт не задерживает)
      fontReady().then(() => !dead && s.setMarks(tireMarks(radius.current?.r ?? null)));
    })().catch(() => !dead && setState("failed"));
    return () => { dead = true; scene.current = null; destroy(); };
  }, [text, radius]);

  useEffect(() => { scene.current?.setMarks(tireMarks(r)); }, [r]);

  if (state === "failed") return <>{fallback}</>;
  return (
    <>
      <canvas ref={cv} role="img" aria-label="Колесо в 3D, его можно покрутить" />
      <picture>
        <source media="(min-width: 960px)" srcSet="/3d/wheel-d.webp" />
        {/* eslint-disable-next-line @next/next/no-img-element -- первый кадр анимации, пока грузится 3D */}
        <img className={`poster${state === "live" ? " off" : ""}`} src="/3d/wheel-m.webp" alt="" aria-hidden="true" />
      </picture>
    </>
  );
}
