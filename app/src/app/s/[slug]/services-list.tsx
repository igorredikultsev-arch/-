"use client";

import { useMemo, useState } from "react";
import type { WidgetService } from "./booking-widget";
import { PICK_EVENT, scrollToBook } from "./events";


const duration = (m: number) => (m < 60 ? `около ${m} минут` : m === 60 ? "около часа" : `около ${Math.round((m / 60) * 10) / 10} ч`);

export function ServicesList({ services }: { services: WidgetService[] }) {
  const categories = useMemo(() => [...new Set(services.map((s) => s.category))], [services]);
  const [cat, setCat] = useState(categories[0]);
  const shown = services.filter((s) => s.category === cat);

  function pick(id: string) {
    window.dispatchEvent(new CustomEvent(PICK_EVENT, { detail: id }));
    scrollToBook();
  }

  return (
    <>
      {categories.length > 1 && (
        <div className="tabs" role="group" aria-label="Категории услуг">
          {categories.map((c) => (
            <button key={c} type="button" aria-pressed={c === cat} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      <div className="svc-list">
        {shown.map((s) => (
          <div className="svc" key={s.id}>
            <div className="n">{s.name}</div>
            <div className="m">{[s.description, duration(s.durationMin)].filter(Boolean).map((t) => t!.replace(/^./, (c) => c.toUpperCase())).join(". ")}</div>
            <div className="p">
              {s.priceFrom > 0 ? `${s.priceFrom.toLocaleString("ru-RU")} ₽` : "бесплатно"}
              {s.priceFrom > 0 && <small>от</small>}
            </div>
            <button type="button" className="go" onClick={() => pick(s.id)}>
              Записаться
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
