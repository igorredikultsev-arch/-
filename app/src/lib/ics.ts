// Разбор календаря .ics (экспорт Google Календаря): события с названием, временем и UID. Чистые функции.
import { addDays, localToUtc } from "./time";

export type IcsEvent = {
  uid: string;
  summary: string;
  description: string;
  /** На весь день: даты включительно; иначе — время в мс UTC */
  allDay: boolean;
  startDate: string;
  endDate: string;
  start: number;
  end: number;
  /** Повторяющееся (RRULE): дни рождения, еженедельные — при переносе пропускаются */
  recurring: boolean;
};
export type IcsCalendar = { name: string; events: IcsEvent[] };

const unescape = (v: string) => v.replace(/\\[nN]/g, "\n").replace(/\\([,;\\])/g, "$1");
const isoDate = (v: string) => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;

/** «20261022T090000» в поясе tz или «…Z» в UTC → мс UTC. */
function moment(value: string, tz: string): number {
  const date = isoDate(value);
  const min = Number(value.slice(9, 11)) * 60 + Number(value.slice(11, 13));
  if (value.endsWith("Z")) {
    const [y, m, d] = date.split("-").map(Number);
    return Date.UTC(y, m - 1, d, 0, min, Number(value.slice(13, 15)) || 0);
  }
  return localToUtc(date, min, tz);
}

export function parseIcs(text: string, fallbackTz: string): IcsCalendar {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  let name = "";
  let tz = fallbackTz;
  const events: IcsEvent[] = [];
  let ev: Record<string, { value: string; params: Record<string, string> }> | null = null;
  let depth = 0; // вложенные блоки события (напоминания VALARM) пропускаются
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const [key, ...rest] = head.split(";");
    const params = Object.fromEntries(rest.map((p) => { const [k, ...v] = p.split("="); return [k.toUpperCase(), v.join("=").replace(/^"|"$/g, "")]; }));
    const k = key.toUpperCase();
    if (k === "BEGIN" && value === "VEVENT") { ev = {}; depth = 0; continue; }
    if (k === "BEGIN" && ev) { depth++; continue; }
    if (k === "END" && ev && depth > 0) { depth--; continue; }
    if (k === "END" && value === "VEVENT" && ev) {
      const e = ev;
      ev = null;
      const s = e.DTSTART;
      if (!s || e.STATUS?.value === "CANCELLED") continue;
      const allDay = s.params.VALUE === "DATE" || /^\d{8}$/.test(s.value);
      const ownTz = s.params.TZID || tz;
      const summary = unescape(e.SUMMARY?.value ?? "").trim();
      const description = unescape(e.DESCRIPTION?.value ?? "").trim();
      const recurring = !!e.RRULE;
      const uid = e.UID?.value ?? "";
      if (allDay) {
        const startDate = isoDate(s.value);
        // Конец дня в .ics не включается: событие на 22 октября — DTEND 23 октября
        const endDate = e.DTEND ? addDays(isoDate(e.DTEND.value), -1) : startDate;
        events.push({ uid, summary, description, allDay, startDate, endDate: endDate < startDate ? startDate : endDate, start: 0, end: 0, recurring });
      } else {
        const start = moment(s.value, ownTz);
        const end = e.DTEND ? moment(e.DTEND.value, e.DTEND.params.TZID || ownTz) : start + 3600000;
        events.push({ uid, summary, description, allDay, startDate: "", endDate: "", start, end: Math.max(end, start + 15 * 60000), recurring });
      }
      continue;
    }
    if (ev) { if (depth === 0 && !(k in ev)) ev[k] = { value, params }; continue; }
    if (k === "X-WR-CALNAME") name = unescape(value).trim();
    if (k === "X-WR-TIMEZONE") tz = value.trim() || tz;
  }
  return { name, events };
}
