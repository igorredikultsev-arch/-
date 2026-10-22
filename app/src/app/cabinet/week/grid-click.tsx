"use client";

import { useRouter } from "next/navigation";

/**
 * Пустое место в колонке календаря: нажали — открывается новая запись на это время (с шагом 15 минут)
 * и к этому сотруднику. Записи лежат поверх и ведут в свою карточку.
 */
export function GridClick({ date, fromMin, toMin, hourPx, staff, view, label }: {
  date: string; fromMin: number; toMin: number; hourPx: number; staff?: string; view: "day" | "week"; label: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={label}
      className="absolute inset-0 cursor-cell focus-visible:outline-2 focus-visible:outline-accent"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const y = e.clientY > 0 ? e.clientY - r.top : 0;
        const min = Math.min(toMin - 15, Math.max(fromMin, fromMin + Math.floor(((y / hourPx) * 60) / 15) * 15));
        const t = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
        router.push(`/cabinet/new?date=${date}&time=${t}${staff ? `&staff=${staff}` : ""}&back=${view}`);
      }}
    />
  );
}
