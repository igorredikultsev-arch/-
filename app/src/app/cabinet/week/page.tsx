import { requireViewer } from "@/lib/auth";
import { assignLanes, calendarLanes, MAX_RANGE_DAYS } from "@/lib/calendar";
import { loadCalendar } from "@/lib/cabinet";
import { formatPhone } from "@/lib/phone";
import { ensureStaff } from "@/lib/staff";
import { addDays, isDateString, toLocal, weekdayOf } from "@/lib/time";
import { Calendar, type CalView } from "./calendar";

// Календарь как Google: данные за видимые дни собираются здесь, всё остальное (перетаскивание, быстрая запись,
// окна записи, скрытие постов) — в calendar.tsx в браузере.

const VIEWS: CalView[] = ["day", "3days", "week", "month", "custom"];
const nextMonth = (d: string) => { const [y, m] = d.split("-").map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`; };

/** Смещение пояса для подписи над часами, как в Google: «GMT+03». */
function gmtLabel(tz: string): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = name.match(/GMT([+-])(\d+)(?::(\d+))?/);
  return m ? `GMT${m[1]}${m[2].padStart(2, "0")}${m[3] ? `:${m[3]}` : ""}` : "GMT";
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; hide?: string; days?: string }> }) {
  const { business, readOnly, masterStaffId } = await requireViewer();
  const tz = business.timezone;
  const sp = await searchParams;
  const view = VIEWS.find((v) => v === sp.view) ?? "week";
  // «Свой период»: дни, выделенные мышкой в мини-календаре, как в Google (от 2 до MAX_RANGE_DAYS)
  const days = Math.min(MAX_RANGE_DAYS, Math.max(2, Math.trunc(Number(sp.days)) || 7));
  const nowMs = Date.now();
  const today = toLocal(nowMs, tz).date;
  const date = sp.date && isDateString(sp.date) ? sp.date : today;
  const monthStart = `${date.slice(0, 8)}01`;
  const monthEnd = addDays(nextMonth(date), -1);
  const first = view === "week" ? addDays(date, 1 - weekdayOf(date)) : view === "month" ? addDays(monthStart, 1 - weekdayOf(monthStart)) : date;
  const last = view === "week" ? addDays(first, 6) : view === "month" ? addDays(monthEnd, 7 - weekdayOf(monthEnd)) : view === "3days" ? addDays(first, 2) : view === "custom" ? addDays(first, days - 1) : first;
  const dates: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) dates.push(d);

  await ensureStaff(business);
  const cal = await loadCalendar(business, dates);
  const lanes = calendarLanes(cal.staff, business.posts, business.standPosts);
  // Запись без поста (с сайта, когда все посты заняты) красится в цвет первого свободного поста
  const laneOf = assignLanes(
    cal.bookings.map((b) => ({ id: b.id, start: b.startAt.getTime(), end: b.endAt.getTime(), staffId: b.staffId, onStand: b.onStand })),
    lanes,
  );
  const open = cal.days.filter((d) => d.win).map((d) => d.win!.openMin);
  const close = cal.days.filter((d) => d.win).map((d) => d.win!.closeMin);

  return (
    <Calendar
      view={view}
      days={days}
      date={date}
      today={today}
      nowMs={nowMs}
      gmt={gmtLabel(tz)}
      dates={dates}
      monthStart={monthStart}
      monthEnd={monthEnd}
      dayStarts={Object.fromEntries(cal.days.map((d) => [d.date, d.start]))}
      scrollMin={Math.max(0, (open.length ? Math.min(...open) : 9 * 60) - 60)}
      // До какого часа видно без прокрутки: конец рабочего дня и час запаса
      scrollEndMin={Math.min(1440, (close.length ? Math.max(...close) : 20 * 60) + 60)}
      // Мастер по умолчанию видит только свой пост; остальные можно включить галочками
      hidden={sp.hide != null || !masterStaffId ? (sp.hide ?? "").split(",").filter(Boolean) : lanes.filter((l) => l.id !== masterStaffId).map((l) => l.id)}
      readOnly={readOnly}
      staff={lanes.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
      bookings={cal.bookings.map((b) => ({
        id: b.id,
        start: b.startAt.getTime(),
        end: b.endAt.getTime(),
        // Запись с сайта: услуга, имя, машина; запись из кабинета — весь её текст
        title: [b.serviceName, b.clientName, b.car].filter(Boolean).join(", "),
        status: b.status,
        site: b.source === "site",
        staffId: laneOf.get(b.id) ?? lanes[0]?.id ?? "",
        ownStaff: !!b.staffId,
        phone: b.clientPhone,
        phoneText: b.clientPhone ? formatPhone(b.clientPhone) : null,
        author: b.source === "site" ? "Записался сам через сайт" : b.externalId ? "Перенесено из Google Календаря" : b.createdBy ? `Внёс: ${b.createdBy.name || formatPhone(b.createdBy.phone)}` : "Внесено в кабинете",
      }))}
      notes={cal.notes}
      explicitView={!!sp.view}
    />
  );
}
