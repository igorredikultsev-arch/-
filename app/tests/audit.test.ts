// Исправления по полной проверке 5 октября: часовые пояса, повторный импорт, шапка «Такси», поиск по номеру,
// «поздно» вместо «занято», обед на витрине, повтор записи, защита служебных адресов.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BookingError, businessForSlotsSelect, createSiteBooking, getDayLoad, getHorizonSummary } from "@/lib/booking";
import { shortName } from "@/lib/business";
import { cronAllowed } from "@/lib/cron";
import { db } from "@/lib/db";
import { parseDemoRows } from "@/lib/demo-import";
import { matchForImport } from "@/lib/import-match";
import { phoneQuery } from "@/lib/phone";
import { pushHostOk } from "@/lib/push";
import { readCsv } from "@/lib/sheet";
import { localToUtc } from "@/lib/time";
import { isAllowedZone, timezoneForCity, ZONES } from "@/lib/timezone";
import { makeBusiness, resetDb } from "./helpers";

const TZ = "Asia/Yekaterinburg";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

/** Смещение пояса от UTC в минутах на дату (Intl, как в браузере клиента). */
function offset(zone: string, at: number) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - at) / 60000;
}

describe("часовой пояс по городу", () => {
  const OWN_ZONE: Record<string, string> = {
    Саратов: "Europe/Saratov", Волгоград: "Europe/Volgograd", Ульяновск: "Europe/Ulyanovsk", Астрахань: "Europe/Astrakhan",
    Барнаул: "Asia/Barnaul", Томск: "Asia/Tomsk", Кемерово: "Asia/Novokuznetsk", Новокузнецк: "Asia/Novokuznetsk", Чита: "Asia/Chita",
  };

  it("для городов со своим поясом ставится пояс из списка админки с тем же временем", () => {
    const at = Date.UTC(2026, 9, 6, 9);
    for (const [city, real] of Object.entries(OWN_ZONE)) {
      const tz = timezoneForCity(city);
      expect(ZONES.some((z) => z.value === tz), city).toBe(true);
      expect(offset(tz, at), city).toBe(offset(real, at));
    }
  });

  it("основные города тоже берут пояс из списка", () => {
    for (const city of ["Пермь", "Москва", "Самара", "Екатеринбург", "Новосибирск", "Красноярск", "Иркутск", "Якутск", "Владивосток", "Калининград", "г. Омск", "неизвестный"]) {
      expect(ZONES.some((z) => z.value === timezoneForCity(city)), city).toBe(true);
    }
  });

  it("старый пояс у уже созданного сервиса можно сохранить, выдуманный — нельзя", () => {
    expect(isAllowedZone("Asia/Novokuznetsk")).toBe(true);
    expect(isAllowedZone("Asia/Yekaterinburg")).toBe(true);
    expect(isAllowedZone("Europe/London")).toBe(false);
  });
});

describe("повторная загрузка таблицы", () => {
  const row = { name: "Шиномонтаж «Ось»", address: "ул. Ленина, 5", twoGisUrl: null };
  const make = (status: "demo" | "archived", lead: "new" | "refused" | "demo_sent") =>
    db.business.create({
      data: { slug: `os-${status}-${lead}`, name: row.name, address: row.address, phone: "+79000000005", status, lead: { create: { status: lead } } },
    });

  it("новый сервис создаётся", async () => {
    expect((await matchForImport(row)).kind).toBe("new");
  });

  it("живое демо — «уже было», без второго демо", async () => {
    const b = await make("demo", "demo_sent");
    expect(await matchForImport(row)).toMatchObject({ kind: "exists", biz: { id: b.id } });
  });

  it("отказавшемуся повторно не пишем, даже если есть живое демо", async () => {
    await make("archived", "refused");
    await make("demo", "new");
    expect(await matchForImport(row)).toMatchObject({ kind: "skip", reason: expect.stringContaining("отказался") });
  });

  it("истёкшее демо в архиве не создаётся заново", async () => {
    const b = await make("archived", "demo_sent");
    expect(await matchForImport(row)).toMatchObject({ kind: "skip", biz: { id: b.id }, reason: expect.stringContaining("архиве") });
  });

  it("строки сверх лимита не теряются молча: их число возвращается", () => {
    const lines = ["Название,Адрес,Телефон", ...Array.from({ length: 305 }, (_, i) => `Сервис ${i},ул. Ленина ${i},8900000${String(i).padStart(4, "0")}`)];
    const res = parseDemoRows(readCsv(Buffer.from(lines.join("\n"))));
    if ("error" in res) throw new Error(res.error);
    expect(res.rows).toHaveLength(300);
    expect(res.cut).toBe(5);
  });
});

describe("короткое имя в шапке «Такси»", () => {
  it("берёт название в кавычках, а вид работ в начале убирает только перед именем", () => {
    expect(shortName("Шиномонтаж «Колесо»")).toBe("Колесо");
    expect(shortName("Шиномонтаж и автосервис «Колесо Фортуны» на Комсомольском проспекте")).toBe("Колесо Фортуны");
    expect(shortName("Автосервис Гараж 59")).toBe("Гараж 59");
    expect(shortName("Шиномонтаж и мойка")).toBe("Шиномонтаж и мойка");
    expect(shortName("Шиномонтаж")).toBe("Шиномонтаж");
    expect(shortName("ШИНОМОНТАЖ Колесо")).toBe("Колесо");
  });
});

describe("поиск по номеру в админке", () => {
  it("номер с 8 и с +7 ищется по последним 10 цифрам", () => {
    expect(phoneQuery("8 912 254-18-73")).toBe("9122541873");
    expect(phoneQuery("+7 (912) 254-18-73")).toBe("9122541873");
    expect(phoneQuery("254-18")).toBe("25418");
    expect(phoneQuery("8 912 254")).toBe("912254");
    expect(phoneQuery("Колесо")).toBe("Колесо");
  });
});

describe("витрина и полоска дней", () => {
  it("сегодня после закрытия — «поздно», а не «занято»; завтра как обычно", async () => {
    const biz = await makeBusiness({ posts: 1 });
    const full = await db.business.findUniqueOrThrow({ where: { id: biz.id }, select: businessForSlotsSelect });
    const evening = localToUtc("2026-10-05", 21 * 60, TZ);
    const days = await getHorizonSummary(full, 40, evening);
    expect(days[0]).toMatchObject({ date: "2026-10-05", closed: false, free: 0, ended: true });
    expect(days[1].ended).toBeUndefined();
    expect(days[1].free).toBeGreaterThan(0);
  });

  it("будущий день, где услуга длиннее рабочих часов, — не «поздно»", async () => {
    const biz = await makeBusiness({ posts: 1 });
    await db.workingHours.updateMany({ where: { businessId: biz.id }, data: { openMin: 600, closeMin: 840 } });
    const full = await db.business.findUniqueOrThrow({ where: { id: biz.id }, select: businessForSlotsSelect });
    const days = await getHorizonSummary(full, 300, localToUtc("2026-10-05", 8 * 60, TZ));
    expect(days.every((d) => d.free === 0 && !d.ended)).toBe(true);
  });

  it("сегодня, но всё занято записями — «занято», а не «поздно»", async () => {
    const biz = await makeBusiness({ posts: 1 });
    await db.workingHours.updateMany({ where: { businessId: biz.id }, data: { openMin: 600, closeMin: 660 } });
    const morning = localToUtc("2026-10-05", 8 * 60, TZ);
    await db.booking.create({
      data: { businessId: biz.id, serviceName: "x", startAt: new Date(localToUtc("2026-10-05", 600, TZ)), endAt: new Date(localToUtc("2026-10-05", 660, TZ)), source: "owner", cancelToken: "t-busy" },
    });
    const full = await db.business.findUniqueOrThrow({ where: { id: biz.id }, select: businessForSlotsSelect });
    const [today] = await getHorizonSummary(full, 40, morning);
    expect(today.free).toBe(0);
    expect(today.ended).toBeUndefined();
  });

  it("витрина получает обед, чтобы рисовать его подписью, а не машиной", async () => {
    const biz = await makeBusiness({ posts: 2 });
    await db.workingHours.updateMany({ where: { businessId: biz.id }, data: { breakFromMin: 780, breakToMin: 840 } });
    const full = await db.business.findUniqueOrThrow({ where: { id: biz.id }, select: businessForSlotsSelect });
    const load = await getDayLoad(full, "2026-10-10", localToUtc("2026-10-05", 600, TZ));
    expect(load?.lunch).toEqual({ from: 780, to: 840 });
  });
});

describe("повтор записи после потерянного ответа", () => {
  it("ссылку на уже созданную запись получает только тот же клиент: телефон, имя и машина", async () => {
    const biz = await makeBusiness({ posts: 2 });
    const now = localToUtc("2026-10-05", 600, TZ);
    const base = { businessId: biz.id, serviceId: biz.services[0].id, date: "2026-10-10", time: "10:00", clientPhone: "+79990001234", nowMs: now, maxActivePerPhone: 1 };
    const first = await createSiteBooking({ ...base, clientName: "Иван", car: "Kia Rio" });
    const again = await createSiteBooking({ ...base, clientName: "Иван", car: "Kia Rio" });
    expect(again.repeated).toBe(true);
    expect(again.cancelToken).toBe(first.cancelToken);
    // Знает телефон и время, но не имя с машиной: ссылку на отмену не получает
    await expect(createSiteBooking({ ...base, clientName: "Пётр", car: "Lada" })).rejects.toMatchObject({ code: "too_many" } satisfies Partial<BookingError>);
  });
});

describe("служебные адреса", () => {
  it("пароль расписания: верный пускает, неверный и другой длины — нет", () => {
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "s3cret-value";
    const req = (h?: string) => new Request("http://x/api/cron/digest", { headers: h ? { authorization: h } : {} });
    expect(cronAllowed(req("Bearer s3cret-value"))).toBe(true);
    expect(cronAllowed(req("Bearer s3cret-valuX"))).toBe(false);
    expect(cronAllowed(req("Bearer s3"))).toBe(false);
    expect(cronAllowed(req())).toBe(false);
    process.env.CRON_SECRET = "change-me";
    expect(cronAllowed(req("Bearer change-me"))).toBe(false);
    process.env.CRON_SECRET = prev;
  });

  it("адрес уведомлений: только службы браузеров, без обходных символов, порта и логина", () => {
    expect(pushHostOk("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(pushHostOk("https://web.push.apple.com/QWE")).toBe(true);
    expect(pushHostOk("https://attacker.example;.fcm.googleapis.com/x")).toBe(false);
    expect(pushHostOk("https://attacker.example{.fcm.googleapis.com/x")).toBe(false);
    expect(pushHostOk("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(pushHostOk("https://user@fcm.googleapis.com/x")).toBe(false);
    expect(pushHostOk("http://fcm.googleapis.com/x")).toBe(false);
    expect(pushHostOk("https://evil.com/fcm.googleapis.com")).toBe(false);
  });
});
