"use client";

import { useActionState, useState } from "react";
import { createBlock } from "../actions";
import { btnPrimary, Field, inputCls, Notice } from "../ui";
import { keepValues } from "@/lib/keep-form";

export function BlockForm({ today, posts }: { today: string; posts: number }) {
  const [state, action, pending] = useActionState(createBlock, null);
  const [allDay, setAllDay] = useState(false);
  return (
    <form onSubmit={keepValues(action)} className="grid gap-4 px-[18px]">
      <Field label="День" htmlFor="bl-date">
        <input id="bl-date" name="date" type="date" min={today} defaultValue={today} required className={inputCls} />
      </Field>
      <label className="flex items-center gap-2.5 text-[15px]">
        <input type="checkbox" name="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-5 accent-accent" />
        Весь день
      </label>
      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="С" htmlFor="bl-from"><input id="bl-from" name="from" type="time" defaultValue="13:00" required className={inputCls} /></Field>
          <Field label="До" htmlFor="bl-to"><input id="bl-to" name="to" type="time" defaultValue="14:00" required className={inputCls} /></Field>
        </div>
      )}
      {posts > 1 && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[13px] font-semibold text-zinc-600">Что закрыть</legend>
          <label className="flex items-center gap-2.5 text-[15px]"><input type="radio" name="scope" value="all" defaultChecked className="size-5 accent-accent" /> Весь сервис</label>
          <label className="flex items-center gap-2.5 text-[15px]"><input type="radio" name="scope" value="one_post" className="size-5 accent-accent" /> Один пост</label>
        </fieldset>
      )}
      <Field label="Причина, видна только вам" htmlFor="bl-reason">
        <input id="bl-reason" name="reason" placeholder="Обед, свой ремонт, выходной" maxLength={60} className={inputCls} />
      </Field>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && <Notice tone="ok">{state.message}</Notice>}
      <button disabled={pending} className={btnPrimary}>{pending ? "Закрываем…" : "Закрыть время"}</button>
    </form>
  );
}
