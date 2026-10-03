"use client";

import { formatDayLong, hhmm } from "@/lib/time";
import type { WidgetService } from "./booking-widget";
import { pickSlot } from "./events";
import { hm, toMin, useDay, useWide } from "./use-day";

const MAX_LANES = 4;
const pct = (m: number, a: number, b: number) => `${(((m - a) / (b - a)) * 100).toFixed(2)}%`;
const wait = (min: number) => (min < 60 ? `через ${min} минут` : `через ${Math.floor(min / 60)} ч${min % 60 ? ` ${min % 60} мин` : ""}`);

/** «Такси»: загрузка постов на ближайший рабочий день, отметка «сейчас» и ближайшее свободное время. */
export function DayLoad(p: { services: WidgetService[]; defaultServiceId: string; apiBase: string }) {
  const d = useDay(p.apiBase, p.defaultServiceId);
  const wide = useWide();
  const load = d.load;
  const free = (d.slots ?? []).filter((s) => s.free).map((s) => s.time);
  const chosen = d.picked && d.picked.date === d.date ? d.picked.time : null;
  const shown = chosen ?? free[0] ?? null;
  const isToday = load?.now != null;

  // Шкала: на компьютере весь день, на телефоне от текущего часа, чтобы окна были шире
  const a = load ? (isToday && !wide ? Math.max(load.open, Math.floor(load.now! / 60) * 60) : load.open) : 0;
  const b = load ? load.close : 1;
  const nowAt = load && isToday ? Math.min(Math.max(load.now!, a), b) : null;

  function gaps(lane: { from: number; to: number }[]) {
    const out: { from: number; to: number }[] = [];
    let t = nowAt ?? a;
    for (const s of lane) {
      if (s.to <= t) continue;
      if (s.from > t) out.push({ from: t, to: s.from });
      t = Math.max(t, s.to);
    }
    if (t < b) out.push({ from: t, to: b });
    return out;
  }
  const ticks: number[] = [];
  if (load) for (let h = Math.ceil(a / 60); h * 60 <= b; h += 2) ticks.push(h * 60);

  return (
    <section className="today" aria-labelledby="today-h">
      <div className="head">
        <b id="today-h">{isToday ? "Сегодня в сервисе" : d.date ? `${formatDayLong(d.date)}, в сервисе` : "В сервисе"}</b>
        {isToday && <span>сейчас {hm(load!.now!)}</span>}
      </div>
      <p className="next">
        <small>{chosen ? "Выбранное время" : "Ближайшее свободное время"}</small>
        <strong>{d.slots === null ? "…" : shown ?? "нет"}</strong>
        {shown && isToday && <span>{wait(toMin(shown) - load!.now!)}</span>}
      </p>
      {load && (
        <div className="tl" role="group" aria-label="Загрузка постов">
          {load.lanes.slice(0, MAX_LANES).map((lane, pi) => (
            <div className="row" key={pi}>
              <span>Пост {pi + 1}</span>
              <div className="lane">
                {nowAt != null && nowAt > a && <i className="blk past" style={{ left: 0, width: pct(nowAt, a, b) }} />}
                {lane.filter((s) => s.to > (nowAt ?? a)).map((s, i) => {
                  const from = Math.max(s.from, nowAt ?? a);
                  return <i key={i} className="blk busy" style={{ left: pct(from, a, b), width: `calc(${pct(s.to, a, b)} - ${pct(from, a, b)} - 3px)` }} />;
                })}
                {gaps(lane).map((g) => {
                  const t = free.find((x) => toMin(x) >= g.from && toMin(x) < g.to);
                  const style = { left: pct(g.from, a, b), width: `calc(${pct(g.to, a, b)} - ${pct(g.from, a, b)} - 3px)` };
                  if (!t) return <i key={g.from} className="blk gap" style={style} />;
                  return (
                    <button
                      key={g.from}
                      type="button"
                      className="blk free"
                      style={style}
                      aria-pressed={t === chosen}
                      aria-label={`Пост ${pi + 1}, свободно с ${hm(toMin(t))}`}
                      onClick={() => d.date && pickSlot({ serviceId: d.serviceId, date: d.date, time: t })}
                    >
                      {wide && (g.to - g.from) / (b - a) > 0.1 && hm(toMin(t))}
                    </button>
                  );
                })}
                {nowAt != null && <i className="now" style={{ left: pct(nowAt, a, b) }} />}
              </div>
            </div>
          ))}
          <div className="axis">
            {ticks.map((t) => (
              <i key={t} style={{ left: pct(t, a, b) }}>
                {hhmm(t).replace(/^0/, "")}
              </i>
            ))}
          </div>
        </div>
      )}
      {d.load === null && <p className="tl-empty">В этот день сервис не работает</p>}
      <div className="tl-foot">
        <div className="legend" aria-hidden="true">
          <span className="lf">свободно, можно нажать</span>
          <span className="lb">занято</span>
        </div>
        <label className="tl-svc">
          <span>для услуги</span>
          <select value={d.serviceId} onChange={(e) => d.setServiceId(e.target.value)}>
            {p.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
