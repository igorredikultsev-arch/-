// Пост под онлайн-запись (решение 9 октября): сайт записывает только на onlinePosts постов, остальные — живая очередь и звонки.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { businessForSlotsSelect, createOwnerBooking, createSiteBooking, getDayLoad, getDaySlots } from "@/lib/booking";
import { db } from "@/lib/db";
import { localToUtc } from "@/lib/time";
import { makeBusiness, resetDb } from "./helpers";

const TZ = "Asia/Yekaterinburg";
const DATE = "2026-10-10";
const NOW = localToUtc("2026-10-05", 600, TZ);

const site = (businessId: string, serviceId: string, n: number) => ({
  businessId, serviceId, date: DATE, time: "10:00", clientName: `Клиент ${n}`, clientPhone: `+7999000${String(n).padStart(4, "0")}`, car: "Kia Rio", nowMs: NOW,
});
const slotsAt10 = async (id: string, serviceId: string) => {
  const biz = await db.business.findUniqueOrThrow({ where: { id }, select: businessForSlotsSelect });
  const service = await db.service.findUniqueOrThrow({ where: { id: serviceId } });
  return (await getDaySlots(biz, DATE, service.durationMin, NOW)).find((s) => s.time === "10:00")!;
};

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("пост под онлайн-запись", () => {
  it("3 поста, 1 под запись: с сайта на одно время записывается только один", async () => {
    const biz = await makeBusiness({ posts: 3, onlinePosts: 1 });
    const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => createSiteBooking(site(biz.id, biz.services[0].id, i))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("звонки, внесённые владельцем, пост под запись не занимают, пока свободен хоть один пост", async () => {
    const biz = await makeBusiness({ posts: 3, onlinePosts: 1 });
    const args = { businessId: biz.id, serviceId: biz.services[0].id, date: DATE, startMin: 600 };
    await createOwnerBooking(args);
    await createOwnerBooking(args);
    expect((await slotsAt10(biz.id, biz.services[0].id)).free).toBe(true);
    // Владелец внёс машину и на третий пост: заняты все, сайт не записывает
    await createOwnerBooking({ ...args, force: true });
    expect((await slotsAt10(biz.id, biz.services[0].id)).free).toBe(false);
  });

  it("«закрыт один пост» закрывает и онлайн-запись: владелец мог закрыть именно пост под запись", async () => {
    const biz = await makeBusiness({ posts: 3, onlinePosts: 1 });
    await db.block.create({
      data: { businessId: biz.id, scope: "one_post", startAt: new Date(localToUtc(DATE, 540, TZ)), endAt: new Date(localToUtc(DATE, 720, TZ)) },
    });
    expect((await slotsAt10(biz.id, biz.services[0].id)).free).toBe(false);
  });

  it("витрина показывает занятым время, когда занят пост под запись, хотя другие посты свободны", async () => {
    const biz = await makeBusiness({ posts: 3, onlinePosts: 1 });
    await createSiteBooking(site(biz.id, biz.services[0].id, 1));
    const full = await db.business.findUniqueOrThrow({ where: { id: biz.id }, select: businessForSlotsSelect });
    const load = await getDayLoad(full, DATE, NOW);
    expect(load?.busy).toEqual([{ from: 600, to: 600 + biz.services[0].durationMin }]);
  });

  it("все посты под запись: как раньше, сайт записывает на каждый пост", async () => {
    const biz = await makeBusiness({ posts: 2, onlinePosts: 2 });
    await createSiteBooking(site(biz.id, biz.services[0].id, 1));
    expect((await slotsAt10(biz.id, biz.services[0].id)).free).toBe(true);
  });

  it("новое демо — один пост под запись", async () => {
    const b = await db.business.create({ data: { slug: "nov", name: "Новый", address: "Пермь, ул. Новая, 1", phone: "+73420000001", posts: 3 } });
    expect(b.onlinePosts).toBe(1);
  });
});
