"use client";

// Услуги «на главный экран» (галочка в кабинете): нажали — форма записи открывается сразу на выборе времени.
import { ArrowRight } from "@phosphor-icons/react";
import { priceText } from "@/lib/service-display";
import { PICK_EVENT, scrollToBook } from "./events";

type Featured = { id: string; name: string; priceFrom: number; priceExact: boolean };

export function FeaturedServices({ services }: { services: Featured[] }) {
  if (!services.length) return null;
  return (
    <div className="feat">
      {services.map((s) => (
        <button key={s.id} type="button" onClick={() => { window.dispatchEvent(new CustomEvent(PICK_EVENT, { detail: s.id })); scrollToBook(); }}>
          <span className="n">{s.name}</span>
          <span className="p">{priceText(s.priceFrom, s.priceExact).replace(/^./, (c) => c.toUpperCase())}</span>
          <span className="ic"><ArrowRight /></span>
        </button>
      ))}
    </div>
  );
}
