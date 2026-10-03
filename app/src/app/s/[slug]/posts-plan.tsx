"use client";

import { formatDayShort, hhmm } from "@/lib/time";
import type { WidgetService } from "./booking-widget";
import { pickSlot } from "./events";
import { busyAt, useDay, useWide } from "./use-day";

const CAR_COLORS = ["#8d969d", "#b7bcc0", "#5f6b75", "#a3896f", "#c3c7ca", "#6d7a84", "#9aa3a9", "#7d8890"];
const MAX_LANES = 4;

/** «План»: вид сверху на посты выбранного дня. Машины на занятых местах, свободные места размечены, на них можно нажать. */
export function PostsPlan(p: { services: WidgetService[]; defaultServiceId: string; apiBase: string; stepMin: number }) {
  const d = useDay(p.apiBase, p.defaultServiceId);
  const wide = useWide();
  const lanes = d.load ? d.load.lanes.slice(0, MAX_LANES) : [];
  const step = Math.max(p.stepMin, 10);

  // Сетка мест: от открытия (сегодня — от текущего времени) до закрытия с шагом записи
  const cells: number[] = [];
  if (d.load) {
    let t = d.load.open;
    if (d.load.now != null) t = Math.max(t, Math.floor(d.load.now / step) * step);
    for (; t + step <= d.load.close; t += step) cells.push(t);
  }
  const freeTimes = new Set((d.slots ?? []).filter((s) => s.free).map((s) => s.time));
  const bookable = cells.filter((t) => freeTimes.has(hhmm(t)));
  let n = 0;

  return (
    <section className="yard" aria-labelledby="yard-h">
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <symbol id="car" viewBox="0 0 40 72">
          <rect x="1" y="21" width="4" height="6" rx="1.5" fill="currentColor" />
          <rect x="35" y="21" width="4" height="6" rx="1.5" fill="currentColor" />
          <rect x="4" y="2" width="32" height="68" rx="11" fill="currentColor" />
          <path d="M9 27c2-6 20-6 22 0l-2 6H11z" fill="#20262b" opacity=".55" />
          <rect x="10" y="34" width="20" height="20" rx="3" fill="#fff" opacity=".16" />
          <path d="M11 56h18l1 6c-5 3-15 3-20 0z" fill="#20262b" opacity=".45" />
          <rect x="8" y="4" width="6" height="3" rx="1.5" fill="#fff" opacity=".6" />
          <rect x="26" y="4" width="6" height="3" rx="1.5" fill="#fff" opacity=".6" />
        </symbol>
      </svg>
      <div className="yard-head">
        <h2 id="yard-h">Свободные места</h2>
        <div className="legend" aria-hidden="true">
          <span className="f">свободно</span>
          <span className="b">занято</span>
        </div>
      </div>
      <label className="yard-svc">
        <span>Услуга</span>
        <select value={d.serviceId} onChange={(e) => d.setServiceId(e.target.value)}>
          {p.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="yard-days" role="group" aria-label="День">
        {d.days === null && <div className="skeleton" style={{ height: 40 }} />}
        {d.days?.slice(0, 7).map((x, i) => {
          const f = formatDayShort(x.date);
          return (
            <button key={x.date} type="button" className="yday" disabled={x.closed} aria-pressed={x.date === d.date} onClick={() => d.setDate(x.date)}>
              {i === 0 ? "Сегодня" : `${f.weekday[0].toUpperCase()}${f.weekday.slice(1)} ${f.day}`}
              {x.closed && <small>выходной</small>}
            </button>
          );
        })}
      </div>

      <div className="floor">
        {d.load === undefined && <div className="skeleton" style={{ height: 240 }} />}
        {d.load === null && <p className="yard-empty">В этот день сервис не работает. Выберите другой.</p>}
        {d.load && cells.length === 0 && <p className="yard-empty">На сегодня запись закончилась. Выберите другой день.</p>}
        {d.load && cells.length > 0 && (
          <div
            className={`plan${wide ? " wide" : ""}${cells.length > 14 ? " dense" : ""}`}
            style={wide ? { gridTemplateColumns: `76px repeat(${cells.length}, minmax(0, 1fr))`, gridTemplateRows: `28px repeat(${lanes.length}, 124px)` } : { gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))`, gridTemplateRows: `32px repeat(${cells.length}, 58px)` }}
            role="group"
            aria-label="План постов"
          >
            {lanes.map((_, pi) => (
              <div key={`l${pi}`} className="lane" style={wide ? { gridRow: pi + 2, gridColumn: 1 } : { gridRow: 1, gridColumn: pi + 1 }}>
                Пост {pi + 1}
              </div>
            ))}
            {wide && cells.map((t, ti) => (
              <div key={`a${t}`} className="ax" style={{ gridRow: 1, gridColumn: ti + 2 }}>
                {hhmm(t)}
              </div>
            ))}
            {lanes.map((lane, pi) => {
              const first = (t: number) => lanes.findIndex((l) => !busyAt(l, t, t + step));
              return cells.map((t, ti) => {
                const pos = wide ? { gridRow: pi + 2, gridColumn: ti + 2 } : { gridRow: ti + 2, gridColumn: pi + 1 };
                const last = ti === cells.length - 1 ? " end" : "";
                const time = hhmm(t);
                if (busyAt(lane, t, t + step)) {
                  const k = n++;
                  return (
                    <div key={`${pi}-${t}`} className={`bay busy${last}`} style={pos} aria-label={`Пост ${pi + 1}, ${time}, занято`}>
                      {!wide && <span className="tm">{time}</span>}
                      <span className="car" style={{ color: CAR_COLORS[(k * 5 + pi) % CAR_COLORS.length], ["--n" as string]: k }}>
                        <svg viewBox="0 0 40 72" width="100%" height="100%" aria-hidden="true">
                          <use href="#car" />
                        </svg>
                      </span>
                    </div>
                  );
                }
                if (freeTimes.has(time) && first(t) === pi) {
                  const on = d.picked?.date === d.date && d.picked?.time === time;
                  return (
                    <button
                      key={`${pi}-${t}`}
                      type="button"
                      className={`bay free${last}`}
                      style={pos}
                      aria-pressed={on}
                      aria-label={`Пост ${pi + 1}, ${time}, свободно`}
                      onClick={() => d.date && pickSlot({ serviceId: d.serviceId, date: d.date, time })}
                    >
                      <span className="tm">{time}</span>
                      {!wide && <span className="go">{on ? "выбрано" : "свободно"}</span>}
                    </button>
                  );
                }
                return (
                  <div key={`${pi}-${t}`} className={`bay${last}`} style={pos}>
                    {!wide && <span className="tm">{time}</span>}
                  </div>
                );
              });
            })}
          </div>
        )}
        {d.load && cells.length > 0 && bookable.length === 0 && <p className="yard-empty">На этот день свободных мест для этой услуги нет. Выберите другой день.</p>}
        {!wide && <div className="gate">Ворота</div>}
      </div>
    </section>
  );
}
