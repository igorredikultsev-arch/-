"use client";

import { useActionState, useState } from "react";
import { Minus, Plus } from "@phosphor-icons/react";
import { keepValues } from "@/lib/keep-form";
import { addException, saveRules, saveService, saveTexts } from "../actions";
import { DatePick, TimeSelect } from "../pickers";
import { Choice, Field, inputCls } from "../ui";
import { Result, SaveBar } from "./result";

export function ExceptionForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(addException, null);
  const [date, setDate] = useState("");
  const [mode, setMode] = useState<"closed" | "short">("closed");
  const [open, setOpen] = useState("10:00");
  const [close, setClose] = useState("16:00");
  return (
    <form onSubmit={keepValues(action)} className="grid gap-3">
      <DatePick name="date" min={today} value={date} onChange={setDate} />
      <input type="hidden" name="mode" value={mode} />
      <div className="grid grid-cols-2 rounded-xl bg-white p-1 text-[15px] font-semibold ring-1 ring-zinc-200" role="group" aria-label="Как работаем в этот день">
        <button type="button" aria-pressed={mode === "closed"} onClick={() => setMode("closed")} className={`rounded-lg py-2.5 ${mode === "closed" ? "bg-ink text-white" : "text-zinc-600"}`}>Не работаем</button>
        <button type="button" aria-pressed={mode === "short"} onClick={() => setMode("short")} className={`rounded-lg py-2.5 ${mode === "short" ? "bg-ink text-white" : "text-zinc-600"}`}>Другие часы</button>
      </div>
      {mode === "short" && (
        <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2 text-[15px] text-zinc-600">
          <span>с</span>
          <TimeSelect name="open" value={open} onChange={setOpen} label="Открытие" />
          <span>до</span>
          <TimeSelect name="close" value={close} onChange={setClose} label="Закрытие" end />
        </div>
      )}
      <Result state={state} />
      <button disabled={pending || !date} className="min-h-13 rounded-xl bg-ink py-3.5 text-[16px] font-semibold text-white disabled:opacity-40">
        {date ? (pending ? "Добавляем…" : "Добавить день") : "Выберите день в календаре"}
      </button>
    </form>
  );
}

type Svc = { id: string; name: string; category: string; description: string | null; priceFrom: number; durationMin: number; isDiagnostic: boolean; active: boolean };

const DURATIONS = [15, 20, 30, 40, 45, 50, 60, 90, 120, 180];

export function ServiceForm({ service, categories }: { service: Svc | null; categories: string[] }) {
  const [state, action, pending] = useActionState(saveService.bind(null, service?.id ?? null), null);
  const dur = service?.durationMin ?? 60;
  return (
    <form onSubmit={keepValues(action)} className="grid gap-5">
      <Field label="Название" htmlFor="sv-name"><input id="sv-name" name="name" defaultValue={service?.name} required maxLength={80} placeholder="Смена колёс R13–R16" className={inputCls} /></Field>
      <Field label="Пояснение для клиента, коротко" htmlFor="sv-desc" hint="Например: снять, разбортировать, отбалансировать">
        <input id="sv-desc" name="description" defaultValue={service?.description ?? ""} maxLength={120} className={inputCls} />
      </Field>
      <Field label="Цена от, ₽" htmlFor="sv-price" hint="0 — на сайте будет написано «бесплатно»">
        <input id="sv-price" name="priceFrom" type="number" min={0} inputMode="numeric" defaultValue={service?.priceFrom ?? 0} className={inputCls} />
      </Field>
      <Choice
        name="durationMin"
        legend="Сколько длится"
        hint="Столько времени машина занимает пост. По этому сайт считает свободные окна"
        value={dur}
        options={(DURATIONS.includes(dur) ? DURATIONS : [...DURATIONS, dur].sort((a, b) => a - b)).map((m) => ({ value: m, label: m < 60 ? `${m} мин` : m % 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m / 60} ч` }))}
      />
      <Field label="Раздел на сайте" htmlFor="sv-cat" hint="Вкладка, где показана услуга: Шиномонтаж, Развал, ТО и масло…">
        <input id="sv-cat" name="category" list="cats" defaultValue={service?.category ?? categories[0]} required maxLength={40} className={inputCls} />
        <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <div className="grid gap-1 rounded-2xl border border-zinc-200 bg-white p-1">
        <label className="flex min-h-13 cursor-pointer items-center gap-3 rounded-xl px-3 hover:bg-zinc-50">
          <input type="checkbox" name="active" defaultChecked={service?.active ?? true} className="size-5 accent-accent" />
          <span className="text-[15px]">Показывать на сайте</span>
        </label>
        <label className="flex min-h-13 cursor-pointer items-start gap-3 rounded-xl px-3 py-3 hover:bg-zinc-50">
          <input type="checkbox" name="isDiagnostic" defaultChecked={service?.isDiagnostic} className="mt-0.5 size-5 accent-accent" />
          <span className="text-[15px] leading-snug">Диагностика: клиент обязательно описывает, что случилось</span>
        </label>
      </div>
      <Result state={state} />
      <SaveBar pending={pending} label={service ? "Сохранить услугу" : "Добавить услугу"} />
    </form>
  );
}

type Fact = { value: string; label: string };

/** Тексты сайта и живой пример фактов: владелец сразу видит, как это будет выглядеть. */
export function TextsForm({ headline, addressNote, facts: initial }: { headline: string; addressNote: string; facts: Fact[] }) {
  const [state, action, pending] = useActionState(saveTexts, null);
  const [facts, setFacts] = useState<Fact[]>([0, 1, 2].map((i) => initial[i] ?? { value: "", label: "" }));
  const set = (i: number, p: Partial<Fact>) => setFacts((all) => all.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const filled = facts.filter((f) => f.value && f.label);
  return (
    <form onSubmit={keepValues(action)} className="grid gap-5">
      <Field label="Главная фраза вверху сайта" htmlFor="st-head" hint="Например: Шиномонтаж без очереди. Запись за минуту">
        <input id="st-head" name="headline" defaultValue={headline} maxLength={70} placeholder="Запись онлайн без очереди" className={inputCls} />
      </Field>
      <Field label="Как найти въезд" htmlFor="st-note" hint="Например: въезд со двора, ворота с вывеской">
        <input id="st-note" name="addressNote" defaultValue={addressNote} maxLength={120} className={inputCls} />
      </Field>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-[15px] font-semibold">Коротко о сервисе</legend>
        <p className="-mt-1 text-[13px] leading-snug text-zinc-500">До трёх карточек в блоке «О сервисе»: крупно — цифра или главное слово, ниже — пояснение.</p>
        {facts.map((f, i) => (
          <div key={i} className="grid grid-cols-[0.75fr_1.25fr] gap-2">
            <input name={`factValue${i}`} value={f.value} onChange={(e) => set(i, { value: e.target.value })} placeholder={["2 поста", "R13–R22", "с 8:00"][i]} aria-label={`Карточка ${i + 1}: крупно`} maxLength={20} className={`${inputCls} font-semibold`} />
            <input name={`factLabel${i}`} value={f.label} onChange={(e) => set(i, { label: e.target.value })} placeholder={["две машины одновременно", "любые диаметры", "работаем без выходных"][i]} aria-label={`Карточка ${i + 1}: пояснение`} maxLength={40} className={inputCls} />
          </div>
        ))}
        <div className="rounded-2xl bg-zinc-200/60 p-3">
          <p className="mb-2 text-[12.5px] font-semibold text-zinc-500">Так будет на сайте</p>
          {filled.length ? (
            <div className="grid grid-cols-2 gap-2">
              {filled.map((f, i) => (
                <div key={i} className="grid gap-0.5 rounded-xl bg-white px-3.5 py-3">
                  <b className="text-[19px] leading-tight">{f.value}</b>
                  <span className="text-[13px] text-zinc-500">{f.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13.5px] text-zinc-500">Заполните обе половинки хотя бы одной карточки, и здесь появится пример.</p>
          )}
        </div>
      </fieldset>
      <Result state={state} />
      <SaveBar pending={pending} label="Сохранить тексты" />
    </form>
  );
}

const withValue = (opts: { value: number; label: string }[], v: number, label: (v: number) => string) =>
  opts.some((o) => o.value === v) ? opts : [...opts, { value: v, label: label(v) }].sort((a, b) => a.value - b.value);
const hours = (m: number) => (m % 60 ? `${m} мин` : `${m / 60} ч`);

type Rules = { posts: number; cancelHours: number; horizonDays: number; minLeadMin: number; slotStepMin: number };

/** Правила записи кнопками вместо чисел. Необычные значения, выставленные раньше, остаются в списке. */
export function RulesForm({ r }: { r: Rules }) {
  const [state, action, pending] = useActionState(saveRules, null);
  const [posts, setPosts] = useState(r.posts);
  return (
    <form onSubmit={keepValues(action)} className="grid gap-7">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-[15px] font-semibold">Сколько машин обслуживаете одновременно</legend>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setPosts((p) => Math.max(1, p - 1))} aria-label="Меньше" className="grid size-12 place-items-center rounded-xl border border-zinc-300 bg-white"><Minus size={20} /></button>
          <output className="min-w-12 text-center text-[28px] font-bold tabular-nums" aria-live="polite">{posts}</output>
          <button type="button" onClick={() => setPosts((p) => Math.min(20, p + 1))} aria-label="Больше" className="grid size-12 place-items-center rounded-xl border border-zinc-300 bg-white"><Plus size={20} /></button>
          <input type="hidden" name="posts" value={posts} />
        </div>
        <p className="text-[13px] leading-snug text-zinc-500">Обычно это число подъёмников или постов. Клиенты этого не видят: так сайт понимает, сколько машин можно записать на одно время.</p>
      </fieldset>
      <Choice
        name="slotStepMin"
        legend="Через сколько начинаются записи"
        hint="Каждые 30 минут — клиенту предлагается 9:00, 9:30, 10:00…"
        value={r.slotStepMin}
        options={[{ value: 15, label: "15 мин" }, { value: 30, label: "30 мин" }, { value: 60, label: "1 час" }]}
      />
      <Choice
        name="minLeadMin"
        legend="Самое раннее время для записи"
        hint="Чтобы клиент не записался на «через 5 минут», когда вы заняты"
        value={r.minLeadMin}
        options={withValue([{ value: 0, label: "Сразу" }, { value: 30, label: "Через 30 мин" }, { value: 60, label: "Через 1 ч" }, { value: 120, label: "Через 2 ч" }, { value: 180, label: "Через 3 ч" }], r.minLeadMin, (v) => `Через ${hours(v)}`)}
      />
      <Choice
        name="horizonDays"
        legend="На сколько дней вперёд можно записаться"
        value={r.horizonDays}
        options={withValue([{ value: 7, label: "Неделя" }, { value: 14, label: "2 недели" }, { value: 30, label: "Месяц" }, { value: 60, label: "2 месяца" }], r.horizonDays, (v) => `${v} дн.`)}
      />
      <Choice
        name="cancelHours"
        legend="До какого времени клиент может отменить запись сам"
        hint="Отменить можно по ссылке, которую клиент получает после записи"
        value={r.cancelHours}
        options={withValue([{ value: 0, label: "До самого визита" }, { value: 2, label: "За 2 часа" }, { value: 24, label: "За сутки" }], r.cancelHours, (v) => `За ${v} ч`)}
      />
      <Result state={state} />
      <SaveBar pending={pending} label="Сохранить правила" />
    </form>
  );
}
