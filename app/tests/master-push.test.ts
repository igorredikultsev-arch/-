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
import { arrivedMessage, masterMessage, notifyBusiness, notifyMaster, ownerDevices } from "@/lib/push";
import { freeStaff } from "@/lib/staff";
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
    return { biz, p3, p5, m3, owner };
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

// Сергей, 13 ноября: «Клиент у нас» — руководителям и мастеру записи; общий календарь «СТО Конкурент» — не пост
describe("клиент у нас и общий календарь", () => {
  beforeEach(async () => { sentTo.length = 0; await resetDb(); });

  it("«Клиент у нас»: другим руководителям и мастеру записи, нажавшему и чужому мастеру нет", async () => {
    const biz = await makeBusiness();
    const p3 = await db.staff.create({ data: { businessId: biz.id, name: "Ромашов", color: "#039be5" } });
    const p5 = await db.staff.create({ data: { businessId: biz.id, name: "Шарапов", color: "#33b679" } });
    const users = {
      admin: await db.user.create({ data: { phone: "+79990000001", passwordHash: "x", role: "owner", businessId: biz.id } }),
      boss: await db.user.create({ data: { phone: "+79990000002", passwordHash: "x", role: "owner", businessId: biz.id } }),
      m3: await db.user.create({ data: { phone: "+79990000003", passwordHash: "x", role: "master", businessId: biz.id, staffId: p3.id } }),
      m5: await db.user.create({ data: { phone: "+79990000005", passwordHash: "x", role: "master", businessId: biz.id, staffId: p5.id } }),
    };
    for (const [e, u] of Object.entries(users)) {
      await db.pushSubscription.create({ data: { endpoint: `https://push.example/${e}`, p256dh: "p256dh-key-123", auth: "auth-key-1", userId: u.id, businessId: biz.id } });
    }
    const m = arrivedMessage({ startAt: new Date("2026-11-13T06:00:00Z"), serviceId: null, serviceName: "Гранта 89200107890 утечка тока" }, "Шарапов", "Europe/Moscow");
    expect(m.title).toBe("Клиент у нас: запись на 09:00");
    expect(m.body).toBe("Шарапов. Подробности в календаре");
    await notifyBusiness(biz.id, m, { staffId: p5.id, except: users.admin.id });
    expect(sentTo.sort()).toEqual(["https://push.example/boss", "https://push.example/m5"]);
  });

  it("запись с сайта не встаёт в общий календарь, даже если он первый и свободен", async () => {
    const biz = await makeBusiness();
    await db.staff.create({ data: { businessId: biz.id, name: "СТО Конкурент", color: "#616161", shared: true, sortOrder: 0 } });
    const post = await db.staff.create({ data: { businessId: biz.id, name: "Андронов", color: "#0b8043", sortOrder: 1 } });
    const start = new Date("2026-11-20T07:00:00Z"), end = new Date("2026-11-20T08:00:00Z");
    expect(await freeStaff(db as never, biz.id, false, start, end, 0)).toBe(post.id);
    await db.booking.create({ data: { businessId: biz.id, staffId: post.id, serviceName: "Масло", startAt: start, endAt: end, source: "owner", cancelToken: "t-shared-1" } });
    // Пост занят — запись остаётся без поста, а не уходит в общий календарь
    expect(await freeStaff(db as never, biz.id, false, start, end, 0)).toBeNull();
  });
});
