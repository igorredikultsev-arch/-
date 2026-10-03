"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WarningCircle } from "@phosphor-icons/react";
import { addDays, formatDayShort } from "@/lib/time";
import { ownerCreateBooking, ownerDaySlots } from "../actions";
import { btnPrimary, Field, inputCls, Notice } from "../ui";

type Svc = { id: string; name: string; durationMin: number };

const chip = (on: boolean) =>
  `rounded-[10px] px-3 py-2.5 text-[14px] ${on ? "bg-ink text-white" : "bg-zinc-200/70 text-ink"} disabled:opacity-35 disabled:line-through`;

export function NewBookingForm({ services, today, initialDate }: { services: Svc[]; today: string; initialDate: string }) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<{ time: string; free: boolean }[] | null>(null);
  const [time, setTime] = useState("");
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const days = Array.from({ length: 10 }, (_, i) => addDays(today, i));

  useEffect(() => {
    if (!serviceId || !date) return;
    let alive = true;
    setSlots(null);
    ownerDaySlots(date, serviceId).then((s) => alive && setSlots(s));
    return () => { alive = false; };
  }, [serviceId, date]);

  // Предупреждение относится к выбранному времени: сменили время, услугу или день — проверяем заново
  useEffect(() => setWarning(null), [serviceId, date, time]);

  function submit(force = false) {
    setError(null);
    start(async () => {
      const r = await ownerCreateBooking({ serviceId, date, time, name, phone, comment, force });
      if (r.error) setError(r.error);
      else if (r.warning) setWarning(r.warning);
      else router.push(`/cabinet?date=${date}`);
    });
  }

  return (
    <form className="grid gap-5 px-[18px]" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-[13px] font-semibold text-zinc-600">Услуга</legend>
        <div className="flex flex-wrap gap-1.5">
          {services.map((s) => (
            <button key={s.id} type="button" aria-pressed={s.id === serviceId} className={chip(s.id === serviceId)} onClick={() => { setServiceId(s.id); setTime(""); }}>
              {s.name}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-[13px] font-semibold text-zinc-600">День</legend>
        <div className="flex flex-wrap gap-1.5">
          {days.map((d, i) => {
            const f = formatDayShort(d);
            return (
              <button key={d} type="button" aria-pressed={d === date} className={chip(d === date)} onClick={() => { setDate(d); setTime(""); }}>
                {i === 0 ? "Сегодня" : i === 1 ? "Завтра" : `${f.weekday} ${f.day}`}
              </button>
            );
          })}
          <input type="date" aria-label="Другая дата" min={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-[42px] rounded-[10px] bg-zinc-200/70 px-2 text-[14px]" />
        </div>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-[13px] font-semibold text-zinc-600">Время</legend>
        {slots === null ? (
          <div className="h-24 animate-pulse rounded-xl bg-zinc-200/70" />
        ) : slots.length === 0 && !custom ? (
          <Notice>В этот день сервис не работает по графику. Можно указать время вручную.</Notice>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {slots.map((s) => (
              <button key={s.time} type="button" aria-pressed={s.time === time} title={s.free ? "" : "Все посты заняты"}
                className={`${chip(s.time === time)} ${!s.free && s.time !== time ? "opacity-45" : ""}`} onClick={() => { setTime(s.time); setCustom(false); }}>
                {s.time}
              </button>
            ))}
          </div>
        )}
        <label className="mt-1 flex items-center gap-2 text-[13.5px] text-zinc-600">
          Другое время:
          <input type="time" value={custom ? time : ""} onChange={(e) => { setTime(e.target.value); setCustom(true); }} className="h-10 rounded-lg border border-zinc-300 bg-white px-2" />
        </label>
        <p className="text-xs text-zinc-500">Бледное время: все посты заняты. Записать всё равно можно.</p>
      </fieldset>
      <Field label="Имя и машина, если клиент назвал" htmlFor="nb-name">
        <input id="nb-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Иван, Камри" maxLength={60} />
      </Field>
      <Field label="Телефон, необязательно" htmlFor="nb-phone">
        <input id="nb-phone" type="tel" inputMode="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7" />
      </Field>
      <Field label="Комментарий" htmlFor="nb-comment">
        <input id="nb-comment" className={inputCls} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      {warning ? (
        <div className="grid gap-3 rounded-2xl bg-orange-50 p-4 text-[14px] text-orange-950">
          <span className="flex gap-2"><WarningCircle size={20} className="shrink-0" />{warning}</span>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="rounded-xl bg-white py-3 font-semibold" onClick={() => setWarning(null)}>Другое время</button>
            <button type="button" disabled={pending} className="rounded-xl bg-orange-600 py-3 font-semibold text-white" onClick={() => submit(true)}>Записать</button>
          </div>
        </div>
      ) : (
        <button type="submit" disabled={pending || !time || !serviceId} className={btnPrimary}>
          {pending ? "Записываем…" : time ? `Записать на ${time}` : "Выберите время"}
        </button>
      )}
    </form>
  );
}
