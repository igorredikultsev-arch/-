"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, WarningCircle } from "@phosphor-icons/react";
import { addDays, formatDayShort } from "@/lib/time";
import { ownerCreateBooking, ownerDaySlots, ownerUpdateBooking } from "../actions";
import { DatePick, TimeField } from "../pickers";
import { hhmm, parseHhmm } from "@/lib/time";
import { btnPrimary, Field, inputCls, Notice } from "../ui";

type Svc = { id: string; name: string; durationMin: number; onStand?: boolean };
type Master = { id: string; name: string; color: string; onStand: boolean };
/** Изменение записи: что в ней сейчас. */
export type EditBooking = { id: string; custom: boolean; title: string; length: number; serviceId: string; staffId: string; name: string; phone: string; comment: string };

const dur = (m: number) => (m < 60 ? `${m} мин` : m % 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m / 60} ч`);
/** Длительность своей записи: от получаса до рабочего дня */
const DURATIONS = [30, 60, 90, 120, 180, 240];

/** Шаг формы: номер и заголовок. Запись идёт по порядку: что делаем → день → время → клиент. */
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

export function NewBookingForm({ services, staff = [], standPosts = 0, today, initialDate, initialTime = "", initialStaff = "", back, edit }: {
  services: Svc[]; staff?: Master[]; standPosts?: number; today: string; initialDate: string; initialTime?: string; initialStaff?: string; back?: string; edit?: EditBooking;
}) {
  const router = useRouter();
  // Своя запись текстом, как событие в календаре (по умолчанию), или услуга из списка
  const firstStaff = edit?.staffId ?? initialStaff;
  const [custom, setCustomMode] = useState(edit?.custom ?? true);
  const [title, setTitle] = useState(edit?.title ?? "");
  const [length, setLength] = useState(edit?.length ?? 60);
  const [staffId, setStaffId] = useState(staff.some((m) => m.id === firstStaff) ? firstStaff : "");
  const [onStand, setOnStand] = useState(staff.find((m) => m.id === firstStaff)?.onStand ?? false);
  const [serviceId, setServiceId] = useState(edit?.serviceId || services[0]?.id || "");
  const [date, setDate] = useState(initialDate);
  const [otherDay, setOtherDay] = useState(false);
  const [slots, setSlots] = useState<{ time: string; free: boolean }[] | null>(null);
  const [time, setTime] = useState(initialTime);
  const [otherTime, setOtherTime] = useState(false);
  const [name, setName] = useState(edit?.name ?? "");
  const [phone, setPhone] = useState(edit?.phone ?? "");
  const [comment, setComment] = useState(edit?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const durations = DURATIONS.includes(length) ? DURATIONS : [...DURATIONS, length].sort((a, b) => a - b);
  const service = services.find((s) => s.id === serviceId);
  const f = formatDayShort(date);

  useEffect(() => {
    if ((!custom && !serviceId) || !date) return;
    let alive = true;
    setSlots(null);
    // Не загрузилось (нет сети) — пустой список: время можно ввести вручную, а не ждать вечную загрузку
    const load = custom ? ownerDaySlots(date, null, { durationMin: length, onStand }) : ownerDaySlots(date, serviceId);
    load.then((s) => alive && setSlots(s)).catch(() => alive && setSlots([]));
    return () => { alive = false; };
  }, [custom, serviceId, length, onStand, date]);

  // Предупреждение относится к выбранному времени: сменили время, услугу или день — проверяем заново
  useEffect(() => setWarning(null), [custom, serviceId, length, onStand, date, time]);

  // Конец записи текстом: длительность считается из «С» и «До»
  const startMin = parseHhmm(time);
  const endText = startMin != null ? hhmm(Math.min(1440, startMin + length)) : "";
  const setEnd = (v: string) => {
    const e = parseHhmm(v);
    if (startMin != null && e != null && e > startMin) setLength(e - startMin);
  };
  // «Весь день» — по часам работы этого дня: от первого окна до закрытия
  const wholeDay = () => {
    const first = slots?.[0], last = slots?.[slots.length - 1];
    const open = first ? parseHhmm(first.time)! : 540;
    const close = last ? parseHhmm(last.time)! + length : 1140;
    setTime(hhmm(open)); setOtherTime(true); setLength(Math.max(15, close - open));
  };
  const pickDay = (d: string) => { setDate(d); setTime(""); setOtherTime(false); };
  const ready = !!time && (custom ? title.trim().length >= 2 : !!serviceId);

  function submit(force = false) {
    setError(null);
    start(async () => {
      // Сбой сети или сервера: введённое остаётся в форме, можно нажать ещё раз
      const what = custom ? { title, durationMin: length, onStand } : { serviceId };
      const who = staffId ? { staffId } : {};
      // Запись одним полем: телефон сервер найдёт в тексте
      const data = { ...what, ...who, date, time, force, ...(custom ? {} : { name, phone, comment }) };
      const r = await (edit ? ownerUpdateBooking(edit.id, data) : ownerCreateBooking(data)).catch(() => ({ error: "Не получилось сохранить. Проверьте интернет и нажмите ещё раз", warning: undefined, id: undefined }));
      if (r.error) setError(r.error);
      else if (r.warning) setWarning(r.warning);
      else router.push(edit ? `/cabinet/b/${edit.id}` : back ? `${back}${back.includes("?") ? "&" : "?"}date=${date}` : `/cabinet?date=${date}`);
    });
  }

  return (
    <form className="grid gap-8 px-[18px] lg:grid-cols-2 lg:items-start lg:gap-x-8 lg:px-0" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
      <Step n={1} title={custom ? "Кого записываем" : "Что делаем"}>
        {services.length > 0 && (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-200/70 p-1" role="group" aria-label="Как записать">
            {[{ v: true, l: "Написать текстом" }, { v: false, l: "Из списка услуг" }].map((o) => (
              <button key={o.l} type="button" aria-pressed={custom === o.v} onClick={() => setCustomMode(o.v)}
                className={`h-10 rounded-lg text-[14.5px] font-semibold ${custom === o.v ? "bg-white shadow-sm" : "text-zinc-600"}`}>
                {o.l}
              </button>
            ))}
          </div>
        )}
        {custom || !services.length ? (
          <div className="grid gap-4">
            <Field label="Запись" htmlFor="nb-title" hint="Всё в одном поле: что делаем, клиент, машина. Если есть телефон, в записи будет кнопка «Позвонить».">
              <textarea id="nb-title" rows={3} className={`${inputCls} h-auto py-3 leading-snug`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={400}
                placeholder="Например, колодки и ходовая, Андрей, Камри, 8 910 123-45-67" />
            </Field>
            <div className="grid gap-2">
              <span className="text-[14.5px] font-semibold">Сколько займёт</span>
              <div className="flex flex-wrap gap-1.5">
                {durations.map((m) => (
                  <button key={m} type="button" aria-pressed={length === m} onClick={() => setLength(m)}
                    className={`h-10 rounded-xl px-3.5 text-[14.5px] font-semibold ${length === m ? "bg-ink text-white" : "bg-white ring-1 ring-zinc-200"}`}>
                    {dur(m)}
                  </button>
                ))}
                <button type="button" onClick={wholeDay} className="h-10 rounded-xl bg-white px-3.5 text-[14.5px] font-semibold ring-1 ring-zinc-200">Весь день</button>
              </div>
              <p className="text-[13px] text-zinc-500">{durations.includes(length) ? "Или впишите время «С» и «До» ниже, тогда длительность посчитается сама." : `Сейчас: ${dur(length)}. Время «С» и «До» — ниже.`}</p>
            </div>
            {standPosts > 0 && !staff.length && (
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-white px-3 ring-1 ring-zinc-200">
                <input type="checkbox" checked={onStand} onChange={(e) => setOnStand(e.target.checked)} className="size-5 accent-accent" />
                <span className="text-[15px]">На стенде развала</span>
              </label>
            )}
          </div>
        ) : (
        <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {services.map((s) => {
            const on = s.id === serviceId;
            return (
              <button key={s.id} type="button" aria-pressed={on} onClick={() => setServiceId(s.id)}
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
        )}
        {staff.length > 0 && (
          <div className="grid gap-2">
            <span className="text-[14.5px] font-semibold">Пост</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Пост">
              {[{ id: "", name: "Любой свободный", color: "" }, ...staff].map((m) => (
                <button key={m.id || "any"} type="button" aria-pressed={staffId === m.id}
                  onClick={() => { setStaffId(m.id); const st = staff.find((x) => x.id === m.id); if (st && custom) setOnStand(st.onStand); }}
                  className={`inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-[14.5px] font-semibold ${staffId === m.id ? "bg-ink text-white" : "bg-white ring-1 ring-zinc-200"}`}>
                  {m.color && <i className="size-3 rounded-full" style={{ background: m.color }} />}
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}
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
                const on = s.time === time && !otherTime;
                return (
                  <button key={s.time} type="button" aria-pressed={on} title={s.free ? "" : "Все посты заняты"} onClick={() => { setTime(s.time); setOtherTime(false); }}
                    className={`h-11 rounded-xl text-[15px] font-semibold tabular-nums ${on ? "bg-ink text-white" : s.free ? "bg-white ring-1 ring-zinc-200" : "bg-zinc-200/60 text-zinc-400"}`}>
                    {s.time}
                  </button>
                );
              })}
            </div>
          )}
          {slots && slots.some((s) => !s.free) && <p className="text-[13px] text-zinc-500">Серым — все посты заняты. Записать всё равно можно.</p>}
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="nb-from" className="shrink-0 text-[14.5px] text-zinc-600">{slots && slots.length ? "Своё время: с" : "С"}</label>
            <div className="w-24">
              <TimeField id="nb-from" value={time} onChange={(v) => { setTime(v); setOtherTime(!!v && !slots?.some((s) => s.time === v)); }} label="Начало" />
            </div>
            {custom && (
              <>
                <label htmlFor="nb-to" className="shrink-0 text-[14.5px] text-zinc-600">до</label>
                <div className="w-24"><TimeField id="nb-to" value={endText} onChange={setEnd} label="Конец" end /></div>
              </>
            )}
          </div>
        </Step>

        {!custom && <Step n={4} title="Клиент">
          <Field label="Имя и машина, если клиент назвал" htmlFor="nb-name">
            <input id="nb-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Иван, Камри" maxLength={60} />
          </Field>
          <Field label="Телефон, необязательно" htmlFor="nb-phone">
            <input id="nb-phone" type="tel" inputMode="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7" />
          </Field>
          <Field label="Комментарий" htmlFor="nb-comment">
            <input id="nb-comment" className={inputCls} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
          </Field>
        </Step>}
      </div>

      <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-10 -mx-[18px] grid gap-2 bg-gradient-to-t from-paper from-75% to-transparent px-[18px] pb-2 pt-5 lg:bottom-0 lg:col-span-2 lg:mx-0 lg:px-0 lg:pb-6">
        {error && <Notice tone="error">{error}</Notice>}
        {warning ? (
          <div className="grid gap-3 rounded-2xl bg-orange-50 p-4 text-[14px] text-orange-950 ring-1 ring-orange-200">
            <span className="flex gap-2"><WarningCircle size={20} className="shrink-0" />{warning}</span>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="rounded-xl bg-white py-3 font-semibold" onClick={() => setWarning(null)}>Другое время</button>
              <button type="button" disabled={pending} className="rounded-xl bg-orange-700 py-3 font-semibold text-white" onClick={() => submit(true)}>{edit ? "Сохранить" : "Записать"}</button>
            </div>
          </div>
        ) : (
          <button type="submit" disabled={pending || !ready} className={`${btnPrimary} w-full flex-col gap-0 leading-tight`}>
            <span>{pending ? (edit ? "Сохраняем…" : "Записываем…") : !time ? "Выберите время" : custom && title.trim().length < 2 ? "Напишите, кого записываем" : `${edit ? "Сохранить" : "Записать"}: ${f.weekday}, ${f.day} ${f.month}, ${time}`}</span>
            {time && !pending && (custom ? title.trim() : service?.name) && (
              <span className="line-clamp-1 text-[13px] font-medium opacity-80">{custom ? `${title.trim()}, ${dur(length)}` : service!.name}</span>
            )}
          </button>
        )}
      </div>
    </form>
  );
}
