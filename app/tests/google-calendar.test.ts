// Календарь как Google (22 октября): раскладка записей, перенос из Google Календаря, перетаскивание.
import { deflateRawSync } from "node:zlib";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createOwnerBooking, moveBooking } from "@/lib/booking";
import { googleLayout } from "@/lib/calendar";
import { importCalendars, readCalendars } from "@/lib/calendar-import";
import { db } from "@/lib/db";
import { parseIcs } from "@/lib/ics";
import { localToUtc } from "@/lib/time";
import { unzip } from "@/lib/unzip";
import { makeBusiness, resetDb } from "./helpers";

const M = 60000;
const ev = (id: string, from: number, to: number) => ({ id, start: from * M, end: to * M });

describe("раскладка как в Google", () => {
  it("одна запись — во всю ширину", () => {
    expect(googleLayout([ev("a", 540, 600)]).get("a")).toMatchObject({ left: 0, width: 1 });
  });

  it("начались одновременно — рядом, левая чуть заходит под правую", () => {
    const l = googleLayout([ev("a", 540, 1140), ev("b", 540, 720)]);
    expect(l.get("a")!.left).toBe(0);
    expect(l.get("b")!.left).toBe(0.5);
    expect(l.get("b")!.width).toBe(0.5);
    expect(l.get("a")!.width).toBeGreaterThan(0.5);
    expect(l.get("b")!.z).toBeGreaterThan(l.get("a")!.z);
  });

  it("началась позже — поверх со сдвигом и до правого края", () => {
    const l = googleLayout([ev("long", 540, 1140), ev("later", 660, 720)]);
    expect(l.get("long")).toMatchObject({ left: 0, width: 1 });
    expect(l.get("later")!.left).toBeCloseTo(0.05);
    expect(l.get("later")!.left + l.get("later")!.width).toBeCloseTo(1);
    expect(l.get("later")!.z).toBeGreaterThan(l.get("long")!.z);
  });

  it("не пересекаются — каждая во всю ширину", () => {
    const l = googleLayout([ev("a", 540, 600), ev("b", 600, 660)]);
    expect(l.get("a")!.width).toBe(1);
    expect(l.get("b")).toMatchObject({ left: 0, width: 1 });
  });
});

const ICS = [
  "BEGIN:VCALENDAR",
  "X-WR-CALNAME:Андронов",
  "X-WR-TIMEZONE:Europe/Moscow",
  "BEGIN:VEVENT",
  "DTSTART;TZID=Europe/Moscow:20261022T090000",
  "DTEND;TZID=Europe/Moscow:20261022T190000",
  "UID:greta-1@google.com",
  "SUMMARY:грета диагностика подвески 8908\\, стук",
  "  спереди",
  "DESCRIPTION:тел 89101234567",
  "BEGIN:VALARM",
  "TRIGGER:-PT10M",
  "DESCRIPTION:напоминание",
  "END:VALARM",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20261022",
  "DTEND;VALUE=DATE:20261023",
  "UID:allday-1@google.com",
  "SUMMARY:108 до 17",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20261023T060000Z",
  "DTEND:20261023T070000Z",
  "UID:utc-1@google.com",
  "SUMMARY:ваз 2106",
  "RRULE:FREQ=WEEKLY",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20261001T060000Z",
  "DTEND:20261001T070000Z",
  "UID:old-1@google.com",
  "SUMMARY:давно",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

/** Архив .zip из файлов (как экспорт Google): локальные заголовки, центральный каталог, конец каталога. */
function makeZip(files: { name: string; text: string }[]): Buffer {
  const locals: Buffer[] = [], centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name), raw = Buffer.from(f.text), data = deflateRawSync(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, data);
    centrals.push(ch, name);
    offset += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

describe("разбор экспорта Google Календаря", () => {
  it("события: время в поясе календаря, перенос строк, весь день, повторяющиеся", () => {
    const cal = parseIcs(ICS, "Asia/Yekaterinburg");
    expect(cal.name).toBe("Андронов");
    const [greta, allDay, weekly] = cal.events;
    expect(greta).toMatchObject({ uid: "greta-1@google.com", summary: "грета диагностика подвески 8908, стук спереди", description: "тел 89101234567", allDay: false, recurring: false });
    expect(greta.start).toBe(localToUtc("2026-10-22", 540, "Europe/Moscow"));
    expect(greta.end - greta.start).toBe(10 * 3600000);
    expect(allDay).toMatchObject({ allDay: true, startDate: "2026-10-22", endDate: "2026-10-22", summary: "108 до 17" });
    expect(weekly).toMatchObject({ recurring: true, start: Date.UTC(2026, 9, 23, 6) });
  });

  it("архив .zip раскрывается, служебные календари отличаются по названию", () => {
    const zip = makeZip([
      { name: "Андронов_abc@group.calendar.google.com.ics", text: ICS },
      { name: "Дни рождения.ics", text: "BEGIN:VCALENDAR\r\nX-WR-CALNAME:Дни рождения\r\nEND:VCALENDAR" },
    ]);
    expect(unzip(zip).map((f) => f.name)).toEqual(["Андронов_abc@group.calendar.google.com.ics", "Дни рождения.ics"]);
    expect(readCalendars([{ name: "calendar.zip", data: zip }], "Europe/Moscow").map((c) => c.name)).toEqual(["Андронов", "Дни рождения"]);
  });
});

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("перенос в кабинет", () => {
  it("календарь Google — пост с тем же названием; с начала недели; без копий при повторе", async () => {
    const biz = await makeBusiness({ posts: 2, onlinePosts: 2 });
    await db.business.update({ where: { id: biz.id }, data: { timezone: "Europe/Moscow" } });
    const andronov = await db.staff.create({ data: { businessId: biz.id, name: "андронов", color: "#0b8043" } });
    const now = localToUtc("2026-10-22", 17 * 60 + 40, "Europe/Moscow");
    const cals = [parseIcs(ICS, "Europe/Moscow"), { ...parseIcs(ICS, "Europe/Moscow"), name: "Завьялов" }];
    const r = await importCalendars({ id: biz.id, timezone: "Europe/Moscow" }, cals, now);
    expect(r.skippedRecurring).toBe(2);
    expect(r.calendars).toEqual([
      { name: "Андронов", staff: "андронов", bookings: 1, notes: 1 },
      // UID те же, что у первого календаря: второй раз не переносятся
      { name: "Завьялов", staff: "Завьялов", bookings: 0, notes: 0 },
    ]);
    const b = await db.booking.findFirstOrThrow({ where: { businessId: biz.id } });
    expect(b).toMatchObject({ staffId: andronov.id, serviceName: "грета диагностика подвески 8908, стук спереди — тел 89101234567", clientPhone: "+79101234567", status: "active", source: "owner" });
    expect(await db.staff.count({ where: { businessId: biz.id, name: "Завьялов" } })).toBe(1);
    const again = await importCalendars({ id: biz.id, timezone: "Europe/Moscow" }, cals.slice(0, 1), now);
    expect(again.calendars[0]).toMatchObject({ bookings: 0, notes: 0 });
  });

  it("перетаскивание меняет время и длительность без проверки постов", async () => {
    const biz = await makeBusiness({ posts: 1, onlinePosts: 1 });
    const tz = biz.timezone;
    await createOwnerBooking({ businessId: biz.id, custom: { title: "А", durationMin: 60 }, date: "2026-10-10", startMin: 600 });
    const second = await createOwnerBooking({ businessId: biz.id, custom: { title: "Б", durationMin: 60 }, date: "2026-10-10", startMin: 720, force: true });
    const start = localToUtc("2026-10-10", 600, tz);
    await moveBooking(biz.id, second.booking!.id, start, start + 90 * M);
    const moved = await db.booking.findUniqueOrThrow({ where: { id: second.booking!.id } });
    expect(moved.startAt.getTime()).toBe(start);
    expect(moved.endAt.getTime() - moved.startAt.getTime()).toBe(90 * M);
  });
});
