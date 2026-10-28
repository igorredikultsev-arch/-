"use client";

import { useActionState, useState } from "react";
import { keepValues } from "@/lib/keep-form";
import { createBlock } from "../actions";
import { DatePick, TimeSelect } from "../pickers";
import { Field, inputCls } from "../ui";
import { Result, SaveBar } from "../site/result";

type Scope = "all" | "one_post";

/** staff — посты (колонки календаря); pick — пост, который закрывают из календаря («Закрыть» у его имени) */
export function BlockForm({ today, date: initial, staff, pick }: { today: string; date: string; staff: { id: string; name: string }[]; pick?: string }) {
  const [state, action, pending] = useActionState(createBlock, null);
  const [date, setDate] = useState(initial);
  const [allDay, setAllDay] = useState(!!pick);
  const [from, setFrom] = useState("13:00");
  const [to, setTo] = useState("14:00");
  const [scope, setScope] = useState<Scope>(pick ? "one_post" : "all");
  const scopes: { value: Scope; label: string }[] = [
    { value: "all", label: "Весь сервис" },
    ...(staff.length > 1 ? [{ value: "one_post" as const, label: "Один пост" }] : []),
  ];
  return (
    <form onSubmit={keepValues(action)} className="grid gap-5 px-[18px] lg:max-w-2xl lg:px-0">
      <DatePick name="date" min={today} value={date} onChange={setDate} />
      {allDay && <input type="hidden" name="allDay" value="on" />}
      <div className="grid grid-cols-2 rounded-xl bg-white p-1 text-[15px] font-semibold ring-1 ring-zinc-200" role="group" aria-label="Сколько закрыть">
        <button type="button" aria-pressed={!allDay} onClick={() => setAllDay(false)} className={`rounded-lg py-2.5 ${!allDay ? "bg-ink text-white" : "text-zinc-600"}`}>Часть дня</button>
        <button type="button" aria-pressed={allDay} onClick={() => setAllDay(true)} className={`rounded-lg py-2.5 ${allDay ? "bg-ink text-white" : "text-zinc-600"}`}>Весь день</button>
      </div>
      {!allDay && (
        <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2 text-[15px] text-zinc-600">
          <span>с</span>
          <TimeSelect name="from" value={from} onChange={setFrom} label="Закрыть с" />
          <span>до</span>
          <TimeSelect name="to" value={to} onChange={setTo} label="Закрыть до" end />
        </div>
      )}
      {scopes.length > 1 && (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-[15px] font-semibold">Что закрыть</legend>
          <input type="hidden" name="scope" value={scope} />
          <div className="flex flex-wrap gap-2">
            {scopes.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={scope === o.value}
                onClick={() => setScope(o.value)}
                className={`inline-flex min-h-11 items-center rounded-xl border px-4 text-[15px] font-medium ${scope === o.value ? "border-ink bg-ink text-white" : "border-zinc-300 bg-white"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-[13px] leading-snug text-zinc-500">
            {scope === "one_post"
              ? "Например, мастер заболел: этот пост не принимает записи, услуги, которые делает только он, недоступны, а остальные пойдут на другие посты"
              : "Сервис не принимает записи совсем"}
          </p>
        </fieldset>
      )}
      {scope === "one_post" && (
        <Field label="Какой пост" htmlFor="bl-staff">
          <select id="bl-staff" name="staffId" className={inputCls} defaultValue={pick ?? staff[0]?.id}>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Сколько дней подряд" htmlFor="bl-days" hint="Например, больничный на неделю: каждый день закроется на это же время">
        <select id="bl-days" name="days" defaultValue="1" className={inputCls}>
          {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n === 1 ? "Только этот день" : `${n} ${n < 5 ? "дня" : "дней"}`}</option>
          ))}
        </select>
      </Field>
      <Field label="Причина, видна только вам" htmlFor="bl-reason">
        <input id="bl-reason" name="reason" placeholder="Обед, свой ремонт, выходной" maxLength={60} className={inputCls} />
      </Field>
      <Result state={state} />
      <SaveBar pending={pending} label="Закрыть время" />
    </form>
  );
}
