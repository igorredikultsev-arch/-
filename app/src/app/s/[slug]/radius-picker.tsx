"use client";

import { useState } from "react";
import type { RadiusBand } from "@/lib/radius";
import type { WidgetService } from "./booking-widget";
import { PICK_EVENT, scrollToBook } from "./events";

const duration = (m: number) => (m < 60 ? `около ${m} минут` : m === 60 ? "около часа" : `около ${Math.round((m / 60) * 10) / 10} ч`);
const price = (p: number) => (p > 0 ? `${p.toLocaleString("ru-RU")} ₽` : "бесплатно");

/** «Боковина»: сначала радиус, сразу цена подходящей услуги и кнопка к выбору времени. */
export function RadiusPicker({ services, bands, radii }: { services: WidgetService[]; bands: RadiusBand[]; radii: number[] }) {
  const [r, setR] = useState(radii.includes(16) ? 16 : radii[0]);
  const band = bands.find((b) => r >= b.from && r <= b.to)!;
  const svc = services.find((s) => s.id === band.serviceId)!;
  const what = svc.name.replace(/\s*R\s?\d{2}.*$/i, "").trim() || svc.name;

  return (
    <section className="size" aria-labelledby="size-h">
      <h2 id="size-h">Какой у вас радиус?</h2>
      <div className="radii" role="group" aria-label="Радиус колёс">
        {radii.map((x) => (
          <button key={x} type="button" className="rad" aria-pressed={x === r} onClick={() => setR(x)}>
            R{x}
          </button>
        ))}
      </div>
      <div className="quote" aria-live="polite">
        <div className="line1">
          <span className="n">
            {what} R{r}
          </span>
          <span className="p">
            {svc.priceFrom > 0 && <small>от</small>}
            {price(svc.priceFrom)}
          </span>
        </div>
        <p className="d">{[svc.description, duration(svc.durationMin)].filter(Boolean).map((t) => t!.replace(/^./, (c) => c.toUpperCase())).join(". ")}</p>
        <button
          type="button"
          className="btn wide"
          onClick={() => {
            window.dispatchEvent(new CustomEvent(PICK_EVENT, { detail: svc.id }));
            scrollToBook();
          }}
        >
          Выбрать время
        </button>
      </div>
    </section>
  );
}
