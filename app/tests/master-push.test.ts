// Уведомления мастерам (29 октября, «Конкурент»): владелец получает всё, мастер — только записи своего поста.
import { beforeEach, describe, expect, it, vi } from "vitest";

const sentTo: string[] = [];
vi.mock("web-push", () => ({
  default: {
    generateVAPIDKeys: () => ({ publicKey: "BPublicKeyForTests", privateKey: "privateKeyForTests" }),
    sendNotification: vi.fn(async (sub: { endpoint: string }) => {
      sentTo.push(sub.endpoint);
    }),
  },
}));

import { db } from "@/lib/db";
import { masterMessage, notifyBusiness, notifyMaster, ownerDevices } from "@/lib/push";
import { makeBusiness, resetDb } from "./helpers";

const msg = { title: "Новая запись", body: "Диагностика", url: "/cabinet" };

describe("уведомления мастерам", () => {
  beforeEach(async () => { sentTo.length = 0; await resetDb(); });

  async function setup() {
    const biz = await makeBusiness();
    const p3 = await db.staff.create({ data: { businessId: biz.id, name: "Пост 3 · Ромашов Максим", color: "#039be5" } });
    const p5 = await db.staff.create({ data: { businessId: biz.id, name: "Пост 5 · Шарапов Иван", color: "#33b679" } });
    const owner = await db.user.create({ data: { phone: "+79990000001", passwordHash: "x", role: "owner", businessId: biz.id } });
    const m3 = await db.user.create({ data: { phone: "+79990000003", passwordHash: "x", role: "master", businessId: biz.id, staffId: p3.id } });
    const m5 = await db.user.create({ data: { phone: "+79990000005", passwordHash: "x", role: "master", businessId: biz.id, staffId: p5.id } });
    for (const [u, e] of [[owner, "owner"], [m3, "m3"], [m5, "m5"]] as const) {
      await db.pushSubscription.create({ data: { endpoint: `https://push.example/${e}`, p256dh: "p256dh-key-123", auth: "auth-key-1", userId: u.id, businessId: biz.id } });
    }
    return { biz, p3, p5, m3 };
  }

  it("запись на пост 5: владельцу и Шарапову, Ромашову нет", async () => {
    const { biz, p5 } = await setup();
    await notifyBusiness(biz.id, msg, { staffId: p5.id });
    expect(sentTo.sort()).toEqual(["https://push.example/m5", "https://push.example/owner"]);
  });

  it("без поста и сводка: только владельцу", async () => {
    const { biz } = await setup();
    await notifyBusiness(biz.id, msg);
    expect(sentTo).toEqual(["https://push.example/owner"]);
    expect(await ownerDevices(biz.id)).toBe(1);
  });

  it("запись поставил владелец: только мастеру поста, владельцу не шлём", async () => {
    const { biz, p5 } = await setup();
    await notifyMaster(biz.id, p5.id, msg);
    expect(sentTo).toEqual(["https://push.example/m5"]);
  });

  it("своя запись без услуги: её текст (там бывают имя и телефон) в уведомление не идёт", () => {
    const startAt = new Date("2026-10-30T07:00:00Z");
    const own = masterMessage("new", { startAt, serviceId: null, serviceName: "Иванов +79991234567 колодки" }, "Europe/Moscow");
    expect(own.body).toBe("Подробности в календаре");
    expect(JSON.stringify(own)).not.toContain("Иванов");
    const moved = masterMessage("moved", { startAt, serviceId: "s1", serviceName: "Диагностика" }, "Europe/Moscow", new Date("2026-10-30T06:00:00Z"));
    expect(moved.title).toContain("Запись перенесли");
    expect(moved.body).toMatch(/^Диагностика\. Было .*09:00$/);
    expect(moved.url).toBe("/cabinet/week?date=2026-10-30");
  });

  it("проверка мастера: только на его телефон", async () => {
    const { biz, m3 } = await setup();
    await notifyBusiness(biz.id, msg, { userId: m3.id });
    expect(sentTo).toEqual(["https://push.example/m3"]);
  });
});
