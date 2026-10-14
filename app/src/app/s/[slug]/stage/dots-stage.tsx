"use client";

import { useEffect, useRef } from "react";
import { accentOf, fontReady, FONT, frozenAt, reducedMotion } from "./shared";

const engine = typeof window === "undefined" ? null : import("./dots");

/** «Частицы»: шина из светящихся точек. */
export function DotsStage({ text, marks }: { text: string; marks: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let dead = false, destroy = () => {};
    (async () => {
      const [{ mountDots }] = await Promise.all([engine!, fontReady()]);
      if (dead || !cv.current) return;
      const s = mountDots(cv.current, { text, marks, accent: accentOf(cv.current), font: FONT, reduced: reducedMotion(), frozenT: frozenAt() });
      if (s) destroy = () => s.destroy();
    })().catch(() => {});
    return () => { dead = true; destroy(); };
  }, [text, marks]);
  return <canvas ref={cv} role="img" aria-label="Шина из светящихся точек" />;
}
