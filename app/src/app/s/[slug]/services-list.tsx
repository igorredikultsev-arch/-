"use client";

import { aboutDuration } from "@/lib/duration";
import type { WidgetService } from "./booking-widget";
import { priceText } from "@/lib/service-display";
import { Categories } from "./categories";
import { PICK_EVENT, scrollToBook } from "./events";


const duration = aboutDuration;

export function ServicesList({ services }: { services: WidgetService[] }) {
  function pick(id: string) {
    window.dispatchEvent(new CustomEvent(PICK_EVENT, { detail: id }));
    scrollToBook();
  }

  return (
    <Categories items={services}>
      {(shown) => (
        <div className="svc-list">
          {shown.map((s) => (
            // Вся строка — кнопка: нажали на услугу, и форма записи открывается с ней
            <button type="button" className="svc" key={s.id} onClick={() => pick(s.id)}>
              <div className="n">{s.name}</div>
              <div className="m">{[s.description, duration(s.durationMin)].filter(Boolean).map((t) => t!.replace(/^./, (c) => c.toUpperCase())).join(". ")}</div>
              <div className="p">
                {s.priceFrom > 0 ? `${s.priceFrom.toLocaleString("ru-RU")} ₽` : priceText(0, s.priceExact)}
                {s.priceFrom > 0 && !s.priceExact && <small>от</small>}
              </div>
            </button>
          ))}
        </div>
      )}
    </Categories>
  );
}
