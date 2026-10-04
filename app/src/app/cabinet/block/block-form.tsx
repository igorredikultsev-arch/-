"use client";

import { useActionState, useState } from "react";
import { keepValues } from "@/lib/keep-form";
import { createBlock } from "../actions";
import { DatePick, TimeSelect } from "../pickers";
import { Choice, Field, inputCls } from "../ui";
import { Result, SaveBar } from "../site/result";

export function BlockForm({ today, date: initial, posts }: { today: string; date: string; posts: number }) {
  const [state, action, pending] = useActionState(createBlock, null);
  const [date, setDate] = useState(initial);
  const [allDay, setAllDay] = useState(false);
  const [from, setFrom] = useState("13:00");
  const [to, setTo] = useState("14:00");
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
          <TimeSelect name="to" value={to} onChange={setTo} label="Закрыть до" />
        </div>
      )}
      {posts > 1 && (
        <Choice name="scope" legend="Что закрыть" value="all" options={[{ value: "all", label: "Весь сервис" }, { value: "one_post", label: "Один пост" }]} hint="Один пост: остальные продолжают принимать записи" />
      )}
      <Field label="Причина, видна только вам" htmlFor="bl-reason">
        <input id="bl-reason" name="reason" placeholder="Обед, свой ремонт, выходной" maxLength={60} className={inputCls} />
      </Field>
      <Result state={state} />
      <SaveBar pending={pending} label="Закрыть время" />
    </form>
  );
}
