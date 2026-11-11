// Календарь как Google (22 октября; раскладка без наложений — 11 ноября): раскладка записей, перенос из Google Календаря, перетаскивание.
import { deflateRawSync } from "node:zlib";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createOwnerBooking, moveBooking } from "@/lib/booking";
import { columnLayout, type Placed } from "@/lib/calendar";
import { importCalendars, matchStaff, readCalendars } from "@/lib/calendar-import";
import { db } from "@/lib/db";
import { parseIcs } from "@/lib/ics";
import { localToUtc } from "@/lib/time";
import { unzip } from "@/lib/unzip";
import { makeBusiness, resetDb } from "./helpers";

const M = 60000;
const ev = (id: string, from: number, to: number, lane = 0) => ({ id, start: from * M, end: to * M, lane });
/** Ни одна плашка не закрыта: та, что выше, начинается хотя бы на столбик правее нижней, начало с текстом видно. */
const noCover = (evs: ReturnType<typeof ev>[], l: Map<string, Placed>) => {
  for (const a of evs) for (const b of evs) {
    if (a === b || !(a.start < b.end && b.start < a.end)) continue;
    const pa = l.get(a.id)!, pb = l.get(b.id)!;
    if (pb.z < pa.z) continue;
    expect(pb.left > pa.left + 1e-9 || pb.left + pb.width <= pa.left + 1e-9, `${b.id} закрывает начало ${a.id}`).toBe(true);
  }
};

describe("раскладка записей: рядом, без лесенки", () => {
  it("одна запись и записи не в одно время — во всю ширину", () => {
    const l = columnLayout([ev("a", 540, 600), ev("b", 600, 660)]);
    expect(l.get("a")).toMatchObject({ left: 0, width: 1 });
    expect(l.get("b")).toMatchObject({ left: 0, width: 1 });
  });

  it("столбики по порядку постов, записи одного поста друг под другом", () => {
    const evs = [ev("p3", 540, 600, 2), ev("p1a", 540, 600, 0), ev("p1b", 600, 660, 0), ev("p2", 570, 690, 1)];
    const l = columnLayout(evs);
    expect([l.get("p1a")!.left, l.get("p2")!.left, l.get("p3")!.left]).toEqual([0, 1 / 3, 2 / 3]);
    expect(l.get("p1b")!.left).toBe(0);
    noCover(evs, l);
  });

  it("справа свободно — плашка шире", () => {
    const l = columnLayout([ev("a", 540, 600, 0), ev("b", 540, 720, 1), ev("c", 660, 720, 0)]);
    // Справа соседка — заходит под неё краем, соседка выше
    expect(l.get("a")).toMatchObject({ left: 0, width: 0.85 });
    expect(l.get("b")).toMatchObject({ left: 0.5, width: 0.5 });
    expect(l.get("b")!.z).toBeGreaterThan(l.get("a")!.z);
    // y — вторая запись поста 1 поверх длинной: свой столбик, и правее до 12:00 свободно (x уже кончилась)
    const free = columnLayout([ev("long", 540, 1140, 0), ev("x", 540, 600, 1), ev("y", 660, 720, 0)]);
    expect(free.get("x")).toMatchObject({ left: 2 / 3, width: 1 / 3 });
    expect(free.get("y")).toMatchObject({ left: 1 / 3, width: 2 / 3 });
    expect(free.get("long")!.width).toBeCloseTo(1.7 / 3);
  });

  it("две записи одного поста в одно время — рядом, а не друг на друге", () => {
    const evs = [ev("a", 540, 660, 0), ev("b", 600, 720, 0)];
    const l = columnLayout(evs);
    expect([l.get("a")!.left, l.get("b")!.left]).toEqual([0, 0.5]);
    noCover(evs, l);
  });

  it("загруженный день клиента (17 записей, 6 постов): ни одна запись не закрыта другой, все в пределах колонки", () => {
    const h = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
    const day: [string, string, string][] = [
      ["грета", "09:00", "19:00"], ["к252ае", "09:00", "17:45"], ["туарег", "09:00", "12:00"], ["Солярис", "09:00", "11:00"],
      ["ламода", "09:00", "10:00"], ["Спортаж", "10:00", "11:30"], ["Гранта", "11:00", "14:00"], ["ламодаШ", "11:00", "12:00"],
      ["ЛОГАН", "11:30", "12:30"], ["L200", "12:00", "19:00"], ["Калина", "12:00", "14:00"], ["калина1", "14:00", "16:00"],
      ["йЗО", "14:00", "15:30"], ["МЛ", "15:30", "16:30"], ["Форд", "16:00", "17:30"], ["Спортейдж", "16:00", "17:00"], ["Рапид", "17:30", "18:30"],
    ];
    const evs = day.map(([id, a, b], i) => ev(id, h(a), h(b), i % 6));
    const l = columnLayout(evs);
    noCover(evs, l);
    for (const e of evs) expect(l.get(e.id)!.left + l.get(e.id)!.width).toBeLessThanOrEqual(1 + 1e-9);
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

describe("календарь Google — к своему посту", () => {
  const staff = [
    { name: "Стенд развала · Хлевной Андрей" }, { name: "Пост 1 · Андронов Александр" }, { name: "Пост 2 · Щелоков Юрий" },
    { name: "Пост 3 · Ромашов Максим" }, { name: "Пост 4 · Новожилов Алексей" }, { name: "Пост 5 · Шарапов Иван" },
  ];
  it("по фамилии, по фамилии с именем, с ё и без", () => {
    expect(matchStaff(staff, "Андронов")?.name).toBe("Пост 1 · Андронов Александр");
    expect(matchStaff(staff, "Шарапов Иван")?.name).toBe("Пост 5 · Шарапов Иван");
    expect(matchStaff(staff, "хлевной")?.name).toBe("Стенд развала · Хлевной Андрей");
    expect(matchStaff([{ name: "Пост 1 · Семёнов" }], "Семенов")?.name).toBe("Пост 1 · Семёнов");
  });
  it("незнакомое или неоднозначное — не угадывает", () => {
    expect(matchStaff(staff, "Завьялов")).toBeUndefined();
    expect(matchStaff([{ name: "Пост 1 · Иван" }, { name: "Пост 2 · Иван" }], "Иван")).toBeUndefined();
    expect(matchStaff(staff, "Пост")).toBeUndefined();
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
