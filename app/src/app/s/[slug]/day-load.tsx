"use client";

import { formatDayShort } from "@/lib/time";
import type { WidgetService } from "./booking-widget";
import { pickSlot } from "./events";
import { hm, toMin, useDay } from "./use-day";

const MAX_TIMES = 12;
const minutesWord = (n: number) =>
  n % 10 === 1 && n % 100 !== 11 ? "минуту" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "минуты" : "минут";
const wait = (min: number) => (min < 60 ? `через ${min} ${minutesWord(min)}` : `через ${Math.floor(min / 60)} ч${min % 60 ? ` ${min % 60} мин` : ""}`);

/** «Такси»: ближайшее свободное время крупно и свободные окна кнопками. Нажали на время — форма сразу просит контакты. */
const windowsWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "окно" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "окна" : "окон");

export function DayLoad(p: { services: WidgetService[]; defaultServiceId: string; apiBase: string; phone: string; phoneLabel: string }) {
  const d = useDay(p.apiBase, p.defaultServiceId);
  const free = (d.slots ?? []).filter((s) => s.free).map((s) => s.time);
  const chosen = d.picked && d.picked.date === d.date ? d.picked.time : null;
  const first = free[0] ?? null;
  const isToday = d.load?.now != null;
  const days = (d.days ?? []).filter((x) => !x.closed).slice(0, 7);
  const label = (date: string) => {
    const f = formatDayShort(date);
    return `${f.weekday} ${f.day}`;
  };

  return (
    <section className="today" aria-labelledby="today-h">
      <div className="head">
        <b id="today-h">Ближайшее свободное время</b>
        {isToday && <span>сейчас {hm(d.load!.now!)}</span>}
      </div>
      <p className="next">
        <strong>{d.slots === null && !d.noneAtAll ? "…" : first ?? "нет"}</strong>
        {first && d.date && <span>{isToday ? wait(toMin(first) - d.load!.now!) : (() => { const f = formatDayShort(d.date); return `${f.weekday}, ${f.day} ${f.month}`; })()}</span>}
      </p>

      {d.noneAtAll ? (
        <p className="tl-empty">
          В ближайшие дни свободного времени нет. Позвоните: <a href={`tel:${p.phone}`}>{p.phoneLabel}</a>
        </p>
      ) : (
        <>
          {/* Услугу клиент выбирает в форме записи, плашка подстраивается под неё сама */}
          <p className="tl-svc">для услуги «{p.services.find((s) => s.id === d.serviceId)?.name}»</p>
          {days.length > 1 && (
            <div className="day-chips" role="group" aria-label="День">
              {days.map((x) => (
                <button key={x.date} type="button" aria-pressed={x.date === d.date} disabled={x.free === 0} onClick={() => d.setDate(x.date)}>
                  {label(x.date)}
                </button>
              ))}
            </div>
          )}
          {d.slots !== null && free.length === 0 ? (
            <p className="tl-empty">В этот день свободного времени нет, выберите другой день.</p>
          ) : (
            <div className="times" role="group" aria-label="Свободное время">
              {(d.slots === null ? Array.from({ length: 8 }, () => "") : free.slice(0, MAX_TIMES)).map((t, i) =>
                t ? (
                  <button key={t} type="button" aria-pressed={t === chosen} onClick={() => d.date && pickSlot({ serviceId: d.serviceId, date: d.date, time: t })}>
                    {t}
                  </button>
                ) : (
                  <span key={i} className="ph" aria-hidden="true" />
                ),
              )}
            </div>
          )}
          {free.length > MAX_TIMES && <p className="tl-more">Ещё {free.length - MAX_TIMES} {windowsWord(free.length - MAX_TIMES)} в этот день — в форме записи</p>}
        </>
      )}
    </section>
  );
}
