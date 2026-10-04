"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { keepValues } from "@/lib/keep-form";
import { saveHours } from "../actions";
import { TimeSelect } from "../pickers";
import { Result, SaveBar } from "./result";

export type DayHours = { weekday: number; closed: boolean; open: string; close: string; breakFrom: string; breakTo: string };

const WD = ["", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const same = (a: DayHours, b: DayHours) =>
  a.closed === b.closed && a.open === b.open && a.close === b.close && a.breakFrom === b.breakFrom && a.breakTo === b.breakTo;

/** Часы работы: будни можно задать один раз, обед прячется за кнопкой. В форму всегда уходят все 7 дней. */
export function HoursForm({ hours }: { hours: DayHours[] }) {
  const [state, action, pending] = useActionState(saveHours, null);
  const [days, setDays] = useState(hours);
  const [weekdaysSame, setWeekdaysSame] = useState(() => hours.slice(1, 5).every((h) => same(h, hours[0])));
  const edit = (wd: number, patch: Partial<DayHours>) =>
    setDays((all) => all.map((d) => (d.weekday === wd || (weekdaysSame && wd <= 5 && d.weekday <= 5) ? { ...d, ...patch } : d)));
  const toggleSame = (on: boolean) => {
    setWeekdaysSame(on);
    // Включили «одинаково»: всем будням часы понедельника
    if (on) setDays((all) => all.map((d) => (d.weekday <= 5 ? { ...all[0], weekday: d.weekday } : d)));
  };
  const shown = weekdaysSame ? days.filter((d) => d.weekday === 1 || d.weekday >= 6) : days;
  return (
    <form onSubmit={keepValues(action)} className="grid gap-3">
      {days.map((d) => (
        <span key={d.weekday} hidden>
          {d.closed && <input type="hidden" name={`closed${d.weekday}`} value="on" />}
          <input type="hidden" name={`open${d.weekday}`} value={d.open} />
          <input type="hidden" name={`close${d.weekday}`} value={d.close} />
          <input type="hidden" name={`breakFrom${d.weekday}`} value={d.breakFrom} />
          <input type="hidden" name={`breakTo${d.weekday}`} value={d.breakTo} />
        </span>
      ))}

      <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4">
        <span className="text-[15px] font-semibold">С понедельника по пятницу одинаково</span>
        <input type="checkbox" checked={weekdaysSame} onChange={(e) => toggleSame(e.target.checked)} className="peer sr-only" />
        <span aria-hidden="true" className="relative h-7 w-12 shrink-0 rounded-full bg-zinc-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2" />
      </label>

      {shown.map((d) => (
        <DayEditor key={d.weekday} day={d} title={weekdaysSame && d.weekday === 1 ? "Будни, пн–пт" : WD[d.weekday]} onChange={(p) => edit(d.weekday, p)} />
      ))}

      <p className="px-1 text-[13px] leading-snug text-zinc-500">В обед и в выходные сайт не предлагает запись. Праздники и сокращённые дни — в разделе «Праздники и особые дни».</p>
      <Result state={state} />
      <SaveBar pending={pending} label="Сохранить часы" />
    </form>
  );
}

function DayEditor({ day, title, onChange }: { day: DayHours; title: string; onChange: (p: Partial<DayHours>) => void }) {
  const hasBreak = !!(day.breakFrom && day.breakTo);
  return (
    <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-[16px]">{title}</b>
        <div className="grid shrink-0 grid-cols-2 rounded-xl bg-paper p-1 text-[14px] font-semibold" role="group" aria-label={`${title}: режим`}>
          <button type="button" aria-pressed={!day.closed} onClick={() => onChange({ closed: false })} className={`rounded-lg px-3 py-1.5 ${!day.closed ? "bg-white shadow-sm" : "text-zinc-500"}`}>Работаем</button>
          <button type="button" aria-pressed={day.closed} onClick={() => onChange({ closed: true })} className={`rounded-lg px-3 py-1.5 ${day.closed ? "bg-white shadow-sm" : "text-zinc-500"}`}>Выходной</button>
        </div>
      </div>
      {!day.closed && (
        <>
          <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2 text-[15px] text-zinc-600">
            <span>с</span>
            <TimeSelect value={day.open} onChange={(v) => onChange({ open: v })} label={`${title}: открытие`} />
            <span>до</span>
            <TimeSelect value={day.close} onChange={(v) => onChange({ close: v })} label={`${title}: закрытие`} />
          </div>
          {hasBreak ? (
            <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2 text-[15px] text-zinc-600">
              <span>обед</span>
              <TimeSelect value={day.breakFrom} onChange={(v) => onChange({ breakFrom: v })} label={`${title}: начало обеда`} />
              <span>–</span>
              <TimeSelect value={day.breakTo} onChange={(v) => onChange({ breakTo: v })} label={`${title}: конец обеда`} />
              <button type="button" onClick={() => onChange({ breakFrom: "", breakTo: "" })} aria-label={`${title}: убрать обед`} className="grid size-10 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100">
                <X size={18} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => onChange({ breakFrom: "13:00", breakTo: "14:00" })} className="inline-flex items-center gap-1.5 justify-self-start text-[14px] font-semibold text-accent">
              <Plus size={16} weight="bold" /> Добавить обед
            </button>
          )}
        </>
      )}
    </div>
  );
}
