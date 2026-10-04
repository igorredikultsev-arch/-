"use client";

import { useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

// Свои поля времени и даты: встроенные в браузер показывают «09:00 AM» и «mm/dd/yyyy», если телефон на английском.

const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);

/** Время по 15 минут, всегда в 24-часовом виде. На телефоне открывается привычным колесом выбора. */
export function TimeSelect({ value, onChange, label, name, end }: { value: string; onChange?: (v: string) => void; label: string; name?: string; end?: boolean }) {
  // Конец промежутка (закрытие, «закрыть до») может быть в полночь: 24:00
  const base = end ? [...TIMES, "24:00"] : TIMES;
  // Время, сохранённое не по сетке 15 минут (например, 09:10), остаётся в списке, чтобы не потерялось
  const list = value && !base.includes(value) ? [...base, value].sort() : base;
  return (
    <select
      name={name}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      aria-label={label}
      className="h-12 w-full min-w-0 appearance-none rounded-xl border border-zinc-300 bg-white px-3 text-center text-[17px] font-semibold tabular-nums outline-none focus:border-transparent focus:ring-2 focus:ring-accent"
    >
      {value === "" && <option value="" disabled>--:--</option>}
      {list.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Календарь на месяц: выбранный день уходит в форму скрытым полем name (ГГГГ-ММ-ДД). Дни раньше min недоступны. */
export function DatePick({ name, min, value, onChange }: { name?: string; min: string; value: string; onChange: (v: string) => void }) {
  const start = value || min;
  const [ym, setYm] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
  const first = new Date(Date.UTC(ym.y, ym.m, 1));
  const lead = (first.getUTCDay() + 6) % 7; // понедельник — первый
  const days = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const minYm = { y: Number(min.slice(0, 4)), m: Number(min.slice(5, 7)) - 1 };
  const canPrev = ym.y > minYm.y || (ym.y === minYm.y && ym.m > minYm.m);
  const move = (d: number) => setYm(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
      {name && <input type="hidden" name={name} value={value} />}
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} disabled={!canPrev} aria-label="Прошлый месяц" className="grid size-10 place-items-center rounded-xl hover:bg-zinc-100 disabled:opacity-30">
          <CaretLeft size={18} />
        </button>
        <b className="text-[16px]">{MONTHS[ym.m]} {ym.y}</b>
        <button type="button" onClick={() => move(1)} aria-label="Следующий месяц" className="grid size-10 place-items-center rounded-xl hover:bg-zinc-100">
          <CaretRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WD.map((w, i) => (
          <span key={w} className={`pb-1 text-[12px] font-semibold ${i > 4 ? "text-orange-700" : "text-zinc-500"}`}>{w}</span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const day = iso(ym.y, ym.m, d);
          const on = day === value;
          const off = day < min;
          return (
            <button
              key={day}
              type="button"
              disabled={off}
              onClick={() => onChange(day)}
              aria-pressed={on}
              aria-label={`${d} ${MONTHS_GEN[ym.m]}`}
              className={`h-11 rounded-xl text-[15px] font-semibold tabular-nums ${on ? "bg-ink text-white" : off ? "text-zinc-300" : "hover:bg-zinc-100"} ${day === min && !on ? "ring-1 ring-inset ring-zinc-300" : ""}`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
