// Перенос записей из Google Календаря: архив экспорта (.zip) или файлы .ics. Календарь Google — пост (сотрудник)
// с тем же названием; нет такого — создаётся. Повторный перенос не создаёт копий (UID события в externalId).
import { db } from "./db";
import { GOOGLE_COLORS } from "./calendar";
import { parseIcs, type IcsCalendar } from "./ics";
import { findPhone } from "./phone";
import { addDays, toLocal, weekdayOf } from "./time";
import { newToken } from "./tokens";
import { unzip } from "./unzip";

export type ImportResult = {
  calendars: { name: string; staff: string; bookings: number; notes: number }[];
  /** Повторяющиеся события (дни рождения, «каждый понедельник») не переносятся */
  skippedRecurring: number;
  /** Служебные календари Google (дни рождения, праздники) */
  skippedCalendars: string[];
};

const SERVICE_CALENDARS = /дни рождения|birthdays|праздник|holidays|задачи|tasks/i;

/** Календари из загруженных файлов: .zip раскрывается, берутся все .ics внутри. */
export function readCalendars(files: { name: string; data: Buffer }[], tz: string): IcsCalendar[] {
  const ics = files.flatMap((f) => (f.name.toLowerCase().endsWith(".zip") ? unzip(f.data) : [f])).filter((f) => f.name.toLowerCase().endsWith(".ics"));
  return ics.map((f) => {
    const cal = parseIcs(f.data.toString("utf8"), tz);
    // Без названия — по имени файла: «Андронов_abc123@group.calendar.google.com.ics»
    return { ...cal, name: cal.name || f.name.replace(/^.*\//, "").replace(/(_[^_]*@.*)?\.ics$/i, "") };
  });
}

export async function importCalendars(business: { id: string; timezone: string }, calendars: IcsCalendar[], nowMs = Date.now()): Promise<ImportResult> {
  const tz = business.timezone;
  // С понедельника текущей недели: неделя в календаре выглядит так же, как была в Google
  const today = toLocal(nowMs, tz).date;
  const fromDate = addDays(today, 1 - weekdayOf(today));
  const fromMs = new Date(`${fromDate}T00:00:00Z`).getTime() - 14 * 3600000; // с запасом на пояс
  const result: ImportResult = { calendars: [], skippedRecurring: 0, skippedCalendars: [] };
  const staff = await db.staff.findMany({ where: { businessId: business.id }, orderBy: { sortOrder: "asc" } });
  for (const cal of calendars) {
    if (SERVICE_CALENDARS.test(cal.name)) { result.skippedCalendars.push(cal.name); continue; }
    const events = cal.events.filter((e) => (e.allDay ? e.endDate >= fromDate : e.end > fromMs && toLocal(e.end, tz).date >= fromDate));
    result.skippedRecurring += events.filter((e) => e.recurring).length;
    const single = events.filter((e) => !e.recurring);
    if (!single.length) continue;
    const name = cal.name.trim().slice(0, 30) || "Календарь";
    let s = staff.find((x) => x.name.trim().toLowerCase() === name.toLowerCase());
    if (!s) {
      const color = GOOGLE_COLORS.find((c) => !staff.some((x) => x.color === c.hex))?.hex ?? GOOGLE_COLORS[staff.length % GOOGLE_COLORS.length].hex;
      s = await db.staff.create({ data: { businessId: business.id, name, color, sortOrder: staff.length } });
      staff.push(s);
    }
    const timed = single.filter((e) => !e.allDay);
    const allDay = single.filter((e) => e.allDay);
    const text = (e: (typeof single)[number]) => [e.summary || "Без названия", e.description].filter(Boolean).join(" — ").slice(0, 400);
    const b = await db.booking.createMany({
      skipDuplicates: true,
      data: timed.map((e) => ({
        businessId: business.id,
        externalId: e.uid ? `g:${e.uid}` : null,
        serviceName: text(e),
        clientPhone: findPhone(`${e.summary} ${e.description}`),
        onStand: s!.onStand,
        staffId: s!.id,
        startAt: new Date(e.start),
        endAt: new Date(e.end),
        source: "owner" as const,
        status: e.end <= nowMs ? ("done" as const) : ("active" as const),
        cancelToken: newToken(),
      })),
    });
    const n = await db.calendarNote.createMany({
      skipDuplicates: true,
      data: allDay.map((e) => ({ businessId: business.id, staffId: s!.id, externalId: e.uid ? `g:${e.uid}` : null, title: text(e).slice(0, 200), startDate: e.startDate, endDate: e.endDate })),
    });
    result.calendars.push({ name: cal.name, staff: s.name, bookings: b.count, notes: n.count });
  }
  return result;
}
