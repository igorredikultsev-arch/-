"use client";

import { useActionState } from "react";
import { addException, saveHours, saveService, saveSettings, type ActionResult } from "../actions";
import { btnPrimary, Field, inputCls, Notice } from "../ui";
import { keepValues } from "@/lib/keep-form";

function Result({ state }: { state: ActionResult }) {
  if (state?.error) return <Notice tone="error">{state.error}</Notice>;
  if (state?.ok) return <Notice tone="ok">{state.message}</Notice>;
  return null;
}

const WD = ["", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
type Hours = { weekday: number; closed: boolean; open: string; close: string; breakFrom: string; breakTo: string };

const timeCls = "h-10 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-1.5 text-[14px]";

/** Часы по дням. На телефоне каждая строка в два-три ряда, чтобы всё помещалось и на узком экране. */
export function HoursForm({ hours }: { hours: Hours[] }) {
  const [state, action, pending] = useActionState(saveHours, null);
  return (
    <form onSubmit={keepValues(action)} className="grid gap-2">
      {hours.map((h) => (
        // Выходной: часы прячутся, чтобы не путать
        <div key={h.weekday} className="grid gap-2 rounded-xl bg-white p-3 ring-1 ring-zinc-200 [&:has(.day-off:checked)_.times]:hidden">
          <div className="flex items-center justify-between gap-3">
            <b className="text-[15px]">{WD[h.weekday]}</b>
            <label className="flex items-center gap-2 text-[14px] text-zinc-600">
              <input type="checkbox" name={`closed${h.weekday}`} defaultChecked={h.closed} className="day-off size-5 accent-accent" />
              Выходной
            </label>
          </div>
          <div className="times grid grid-cols-[48px_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2 text-[13px] text-zinc-500">
            <span>Часы</span>
            <input type="time" name={`open${h.weekday}`} defaultValue={h.open} aria-label={`${WD[h.weekday]}: открытие`} className={timeCls} />
            <span>–</span>
            <input type="time" name={`close${h.weekday}`} defaultValue={h.close} aria-label={`${WD[h.weekday]}: закрытие`} className={timeCls} />
            <span>Обед</span>
            <input type="time" name={`breakFrom${h.weekday}`} defaultValue={h.breakFrom} aria-label={`${WD[h.weekday]}: начало обеда`} className={timeCls} />
            <span>–</span>
            <input type="time" name={`breakTo${h.weekday}`} defaultValue={h.breakTo} aria-label={`${WD[h.weekday]}: конец обеда`} className={timeCls} />
          </div>
        </div>
      ))}
      <p className="px-1 text-[12.5px] text-zinc-500">Обед необязателен. В это время сайт не предлагает запись, а в кабинете оно отмечено как закрытое.</p>
      <Result state={state} />
      <button disabled={pending} className={btnPrimary}>{pending ? "Сохраняем…" : "Сохранить часы"}</button>
    </form>
  );
}

export function ExceptionForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(addException, null);
  return (
    <form onSubmit={keepValues(action)} className="grid gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-zinc-200">
      <Field label="Праздник или особый день" htmlFor="ex-date"><input id="ex-date" type="date" name="date" min={today} required className={inputCls} /></Field>
      <div className="flex flex-wrap gap-4 text-[14px]">
        <label className="flex items-center gap-2"><input type="radio" name="mode" value="closed" defaultChecked className="accent-accent" /> Не работаем</label>
        <label className="flex items-center gap-2"><input type="radio" name="mode" value="short" className="accent-accent" /> Другие часы:</label>
        <span className="flex items-center gap-1">
          <input type="time" name="open" defaultValue="10:00" aria-label="Открытие" className="h-9 rounded-lg border border-zinc-300 px-1" />-
          <input type="time" name="close" defaultValue="16:00" aria-label="Закрытие" className="h-9 rounded-lg border border-zinc-300 px-1" />
        </span>
      </div>
      <Result state={state} />
      <button disabled={pending} className="rounded-xl bg-zinc-200/70 py-3 text-[15px] font-semibold">Добавить</button>
    </form>
  );
}

type Svc = { id: string; name: string; category: string; description: string | null; priceFrom: number; durationMin: number; isDiagnostic: boolean; active: boolean };

export function ServiceForm({ service, categories }: { service: Svc | null; categories: string[] }) {
  const [state, action, pending] = useActionState(saveService.bind(null, service?.id ?? null), null);
  return (
    <form onSubmit={keepValues(action)} className="grid gap-4">
      <Field label="Название" htmlFor="sv-name"><input id="sv-name" name="name" defaultValue={service?.name} required maxLength={80} className={inputCls} /></Field>
      <Field label="Раздел" htmlFor="sv-cat" hint="Вкладка на сайте: Шиномонтаж, Развал, ТО и масло…">
        <input id="sv-cat" name="category" list="cats" defaultValue={service?.category ?? categories[0]} required maxLength={40} className={inputCls} />
        <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <Field label="Пояснение, коротко" htmlFor="sv-desc"><input id="sv-desc" name="description" defaultValue={service?.description ?? ""} maxLength={120} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Цена от, ₽" htmlFor="sv-price" hint="0 — бесплатно"><input id="sv-price" name="priceFrom" type="number" min={0} inputMode="numeric" defaultValue={service?.priceFrom ?? 0} className={inputCls} /></Field>
        <Field label="Длительность, мин" htmlFor="sv-dur" hint="Сколько держит пост"><input id="sv-dur" name="durationMin" type="number" min={10} step={5} inputMode="numeric" defaultValue={service?.durationMin ?? 60} required className={inputCls} /></Field>
      </div>
      <label className="flex items-start gap-2.5 text-[14px]"><input type="checkbox" name="isDiagnostic" defaultChecked={service?.isDiagnostic} className="mt-0.5 size-5 accent-accent" /><span>Диагностика: клиент обязательно описывает проблему</span></label>
      <label className="flex items-center gap-2.5 text-[14px]"><input type="checkbox" name="active" defaultChecked={service?.active ?? true} className="size-5 accent-accent" /> Показывать на сайте</label>
      <Result state={state} />
      <button disabled={pending} className={btnPrimary}>{pending ? "Сохраняем…" : service ? "Сохранить" : "Добавить услугу"}</button>
    </form>
  );
}

type Settings = { headline: string; addressNote: string; posts: number; cancelHours: number; horizonDays: number; minLeadMin: number; slotStepMin: number; facts: { value: string; label: string }[] };

export function SettingsForm({ s }: { s: Settings }) {
  const [state, action, pending] = useActionState(saveSettings, null);
  const facts = [0, 1, 2].map((i) => s.facts[i] ?? { value: "", label: "" });
  return (
    <form onSubmit={keepValues(action)} className="grid gap-4">
      <Field label="Заголовок на сайте" htmlFor="st-head" hint="Например: Шиномонтаж без очереди. Запись за минуту"><input id="st-head" name="headline" defaultValue={s.headline} maxLength={70} className={inputCls} /></Field>
      <Field label="Как найти въезд" htmlFor="st-note" hint="Например: Въезд со двора, ворота с вывеской"><input id="st-note" name="addressNote" defaultValue={s.addressNote} maxLength={120} className={inputCls} /></Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-[13px] font-semibold text-zinc-600">Факты о сервисе, до трёх</legend>
        {facts.map((f, i) => (
          <div key={i} className="grid grid-cols-[0.8fr_1.2fr] gap-2">
            <input name={`factValue${i}`} defaultValue={f.value} placeholder="2 поста" aria-label={`Факт ${i + 1}: крупно`} maxLength={20} className={inputCls} />
            <input name={`factLabel${i}`} defaultValue={f.label} placeholder="можно приехать вдвоём" aria-label={`Факт ${i + 1}: подпись`} maxLength={40} className={inputCls} />
          </div>
        ))}
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Постов" htmlFor="st-posts" hint="Машин одновременно"><input id="st-posts" name="posts" type="number" min={1} max={20} defaultValue={s.posts} className={inputCls} /></Field>
        <Field label="Шаг записи" htmlFor="st-step">
          <select id="st-step" name="slotStepMin" defaultValue={s.slotStepMin} className={inputCls}>
            <option value={15}>15 минут</option><option value={30}>30 минут</option><option value={60}>1 час</option>
          </select>
        </Field>
        <Field label="Отмена клиентом, ч" htmlFor="st-cancel" hint="Не позже чем за"><input id="st-cancel" name="cancelHours" type="number" min={0} max={168} defaultValue={s.cancelHours} className={inputCls} /></Field>
        <Field label="Запись вперёд, дней" htmlFor="st-hor"><input id="st-hor" name="horizonDays" type="number" min={1} max={60} defaultValue={s.horizonDays} className={inputCls} /></Field>
        <Field label="Не раньше чем через, мин" htmlFor="st-lead" hint="От текущего момента"><input id="st-lead" name="minLeadMin" type="number" min={0} step={15} defaultValue={s.minLeadMin} className={inputCls} /></Field>
      </div>
      <Result state={state} />
      <button disabled={pending} className={btnPrimary}>{pending ? "Сохраняем…" : "Сохранить"}</button>
    </form>
  );
}
