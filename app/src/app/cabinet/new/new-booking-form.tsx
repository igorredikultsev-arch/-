"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, WarningCircle } from "@phosphor-icons/react";
import { addDays, formatDayShort } from "@/lib/time";
import { ownerCreateBooking, ownerDaySlots } from "../actions";
import { DatePick, TimeSelect } from "../pickers";
import { btnPrimary, Field, inputCls, Notice } from "../ui";

type Svc = { id: string; name: string; durationMin: number };

const dur = (m: number) => (m < 60 ? `${m} мин` : m % 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m / 60} ч`);

/** Шаг формы: номер и заголовок. Запись действительно идёт по порядку: услуга → день → время → клиент. */
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-3 flex items-center gap-2.5 text-[17px] font-bold">
        <span className="grid size-7 place-items-center rounded-full bg-ink text-[13px] text-white">{n}</span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

export function NewBookingForm({ services, today, initialDate }: { services: Svc[]; today: string; initialDate: string }) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState(initialDate);
  const [otherDay, setOtherDay] = useState(false);
  const [slots, setSlots] = useState<{ time: string; free: boolean }[] | null>(null);
  const [time, setTime] = useState("");
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const service = services.find((s) => s.id === serviceId);
  const f = formatDayShort(date);

  useEffect(() => {
    if (!serviceId || !date) return;
    let alive = true;
    setSlots(null);
    // Не загрузилось (нет сети) — пустой список: время можно ввести вручную, а не ждать вечную загрузку
    ownerDaySlots(date, serviceId).then((s) => alive && setSlots(s)).catch(() => alive && setSlots([]));
    return () => { alive = false; };
  }, [serviceId, date]);

  // Предупреждение относится к выбранному времени: сменили время, услугу или день — проверяем заново
  useEffect(() => setWarning(null), [serviceId, date, time]);

  const pickDay = (d: string) => { setDate(d); setTime(""); setCustom(false); };

  function submit(force = false) {
    setError(null);
    start(async () => {
      // Сбой сети или сервера: введённое остаётся в форме, можно нажать ещё раз
      const r = await ownerCreateBooking({ serviceId, date, time, name, phone, comment, force }).catch(() => ({ error: "Не получилось сохранить. Проверьте интернет и нажмите ещё раз", warning: undefined, id: undefined }));
      if (r.error) setError(r.error);
      else if (r.warning) setWarning(r.warning);
      else router.push(`/cabinet?date=${date}`);
    });
  }

  return (
    <form className="grid gap-8 px-[18px] lg:grid-cols-2 lg:items-start lg:gap-x-8 lg:px-0" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
      <Step n={1} title="Услуга">
        <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {services.map((s) => {
            const on = s.id === serviceId;
            return (
              <button key={s.id} type="button" aria-pressed={on} onClick={() => { setServiceId(s.id); setTime(""); }}
                className={`flex min-h-13 w-full items-center gap-3 px-4 py-2.5 text-left ${on ? "bg-orange-50" : "hover:bg-zinc-50"}`}>
                <span className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${on ? "border-accent bg-accent text-white" : "border-zinc-300"}`}>
                  {on && <Check size={14} weight="bold" />}
                </span>
                <span className="min-w-0 flex-1 text-[15.5px] font-medium leading-tight">{s.name}</span>
                <span className="shrink-0 text-[13.5px] text-zinc-500">{dur(s.durationMin)}</span>
              </button>
            );
          })}
        </div>
      </Step>

      <div className="grid content-start gap-8">
        <Step n={2} title="День">
          <div className="-mx-[18px] flex gap-1.5 overflow-x-auto px-[18px] pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
            {days.map((d, i) => {
              const x = formatDayShort(d);
              const on = d === date && !otherDay;
              return (
                <button key={d} type="button" aria-pressed={on} onClick={() => { setOtherDay(false); pickDay(d); }}
                  className={`grid min-w-14 shrink-0 justify-items-center rounded-xl px-2 py-2 ${on ? "bg-ink text-white" : "bg-white ring-1 ring-zinc-200"}`}>
                  <span className={`text-[12px] ${on ? "text-white/70" : "text-zinc-500"}`}>{i === 0 ? "сегодня" : i === 1 ? "завтра" : x.weekday}</span>
                  <b className="text-[17px] tabular-nums">{x.day}</b>
                </button>
              );
            })}
            <button type="button" aria-pressed={otherDay} onClick={() => setOtherDay((v) => !v)}
              className={`shrink-0 rounded-xl px-3.5 text-[14px] font-semibold ${otherDay ? "bg-ink text-white" : "bg-white ring-1 ring-zinc-200"}`}>
              Другой
            </button>
          </div>
          {otherDay && <DatePick min={today} value={date} onChange={pickDay} />}
        </Step>

        <Step n={3} title="Время">
          {slots === null ? (
            <div className="h-28 animate-pulse rounded-2xl bg-zinc-200/70" />
          ) : slots.length === 0 ? (
            <Notice>В этот день сервис не работает по графику. Время можно указать вручную ниже.</Notice>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
              {slots.map((s) => {
                const on = s.time === time && !custom;
                return (
                  <button key={s.time} type="button" aria-pressed={on} title={s.free ? "" : "Все посты заняты"} onClick={() => { setTime(s.time); setCustom(false); }}
                    className={`h-11 rounded-xl text-[15px] font-semibold tabular-nums ${on ? "bg-ink text-white" : s.free ? "bg-white ring-1 ring-zinc-200" : "bg-zinc-200/60 text-zinc-400"}`}>
                    {s.time}
                  </button>
                );
              })}
            </div>
          )}
          {slots && slots.some((s) => !s.free) && <p className="text-[13px] text-zinc-500">Серым — все посты заняты. Записать всё равно можно.</p>}
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-[14.5px] text-zinc-600">Другое время</span>
            <div className="w-32">
              <TimeSelect value={custom ? time : ""} onChange={(v) => { setTime(v); setCustom(true); }} label="Другое время" />
            </div>
          </div>
        </Step>

        <Step n={4} title="Клиент">
          <Field label="Имя и машина, если клиент назвал" htmlFor="nb-name">
            <input id="nb-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Иван, Камри" maxLength={60} />
          </Field>
          <Field label="Телефон, необязательно" htmlFor="nb-phone">
            <input id="nb-phone" type="tel" inputMode="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7" />
          </Field>
          <Field label="Комментарий" htmlFor="nb-comment">
            <input id="nb-comment" className={inputCls} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
          </Field>
        </Step>
      </div>

      <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-10 -mx-[18px] grid gap-2 bg-gradient-to-t from-paper from-75% to-transparent px-[18px] pb-2 pt-5 lg:bottom-0 lg:col-span-2 lg:mx-0 lg:px-0 lg:pb-6">
        {error && <Notice tone="error">{error}</Notice>}
        {warning ? (
          <div className="grid gap-3 rounded-2xl bg-orange-50 p-4 text-[14px] text-orange-950 ring-1 ring-orange-200">
            <span className="flex gap-2"><WarningCircle size={20} className="shrink-0" />{warning}</span>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="rounded-xl bg-white py-3 font-semibold" onClick={() => setWarning(null)}>Другое время</button>
              <button type="button" disabled={pending} className="rounded-xl bg-orange-700 py-3 font-semibold text-white" onClick={() => submit(true)}>Записать</button>
            </div>
          </div>
        ) : (
          <button type="submit" disabled={pending || !time || !serviceId} className={`${btnPrimary} w-full flex-col gap-0 leading-tight`}>
            <span>{pending ? "Записываем…" : time ? `Записать на ${f.weekday}, ${f.day} ${f.month}, ${time}` : "Выберите время"}</span>
            {time && service && !pending && <span className="text-[13px] font-medium opacity-80">{service.name}</span>}
          </button>
        )}
      </div>
    </form>
  );
}
