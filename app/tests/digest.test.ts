// Утренняя сводка владельцу: текст, окно 8–10 утра по времени сервиса, одна сводка в день.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const sent: string[] = [];
vi.mock("web-push", () => ({
  default: {
    generateVAPIDKeys: () => ({ publicKey: "BPublicKeyForTests", privateKey: "privateKeyForTests" }),
    sendNotification: vi.fn(async (_sub: unknown, payload: string) => {
      sent.push(payload);
    }),
  },
}));

import { db } from "@/lib/db";
import { digestMessage, runDigest } from "@/lib/digest";
import { localToUtc } from "@/lib/time";
import { makeBusiness, resetDb } from "./helpers";

const TZ = "Asia/Yekaterinburg";
const at = (date: string, time: string) => new Date(localToUtc(date, Number(time.slice(0, 2)) * 60 + Number(time.slice(3)), TZ));

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
});
afterAll(() => db.$disconnect());

describe("текст сводки", () => {
  it("число записей, первая и последняя, сколько с сайта", () => {
    const m = digestMessage(
      [
        { startAt: at("2026-10-05", "14:00"), source: "owner" },
        { startAt: at("2026-10-05", "09:30"), source: "site" },
        { startAt: at("2026-10-05", "17:00"), source: "site" },
      ],
      TZ,
    );
    expect(m).toMatchObject({ title: "Сегодня 3 записи", body: "Первая в 9:30, последняя в 17:00. С сайта — 2", url: "/cabinet" });
  });
  it("одна запись и пустой день", () => {
    expect(digestMessage([{ startAt: at("2026-10-05", "11:00"), source: "site" }], TZ)).toMatchObject({ title: "Сегодня 1 запись", body: "В 11:00. С сайта" });
    expect(digestMessage([], TZ)).toBeNull();
  });
});

describe("рассылка", () => {
  async function setup(enabled = true) {
    const biz = await makeBusiness();
    await db.business.update({ where: { id: biz.id }, data: { status: "active", digestEnabled: enabled } });
    const user = await db.user.create({ data: { phone: "+79990002222", passwordHash: "x", businessId: biz.id } });
    await db.pushSubscription.create({ data: { endpoint: "https://push.example/a", p256dh: "p256dh-key-123", auth: "auth-key-1", userId: user.id, businessId: biz.id } });
    const base = { businessId: biz.id, serviceName: "Смена колёс", source: "site" as const };
    await db.booking.createMany({
      data: [
        { ...base, startAt: at("2026-10-05", "10:00"), endAt: at("2026-10-05", "10:40"), cancelToken: "t1" },
        { ...base, startAt: at("2026-10-05", "12:00"), endAt: at("2026-10-05", "12:40"), cancelToken: "t2", status: "cancelled" },
        { ...base, startAt: at("2026-10-06", "10:00"), endAt: at("2026-10-06", "10:40"), cancelToken: "t3" },
      ],
    });
    return biz;
  }

  it("в 8 утра приходит одна сводка за день, повторный запуск ничего не шлёт", async () => {
    await setup();
    expect(await runDigest(at("2026-10-05", "07:30"))).toMatchObject({ sent: 0 });
    expect(await runDigest(at("2026-10-05", "08:03"))).toMatchObject({ sent: 1 });
    expect(await runDigest(at("2026-10-05", "09:03"))).toMatchObject({ sent: 0 });
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0])).toMatchObject({ title: "Сегодня 1 запись" });
    // На следующий день — снова
    expect(await runDigest(at("2026-10-06", "08:03"))).toMatchObject({ sent: 1 });
  });

  it("пропущенный час догоняется до 10 утра, позже — уже нет", async () => {
    await setup();
    expect(await runDigest(at("2026-10-05", "10:03"))).toMatchObject({ sent: 0 });
    expect(await runDigest(at("2026-10-06", "09:40"))).toMatchObject({ sent: 1 });
  });

  it("выключенная сводка и приостановленный сайт не получают", async () => {
    const biz = await setup(false);
    expect(await runDigest(at("2026-10-05", "08:03"))).toMatchObject({ checked: 0 });
    await db.business.update({ where: { id: biz.id }, data: { digestEnabled: true, status: "suspended" } });
    expect(await runDigest(at("2026-10-05", "08:03"))).toMatchObject({ checked: 0 });
  });
});
