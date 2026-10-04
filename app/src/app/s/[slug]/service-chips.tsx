"use client";

import type { WidgetService } from "./booking-widget";

/** Выбор услуги кнопками вместо выпадающего списка: системный список на компьютере выглядит чужеродно. */
export function ServiceChips({ services, value, onChange, label }: { services: WidgetService[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <div className="svc-chips" role="group" aria-label={label}>
      {services.map((s) => (
        <button key={s.id} type="button" aria-pressed={s.id === value} onClick={() => onChange(s.id)}>
          {s.name}
        </button>
      ))}
    </div>
  );
}
