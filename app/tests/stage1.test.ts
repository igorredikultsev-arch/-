// Этап 1 после проверки 4 октября: защита страниц, проверка сертификатов, демо без персональных данных,
// одна запись на номер, реквизиты оператора, настройки сервера, удаление старых архивных демо.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as tlsCheck } from "@/app/api/tls-check/route";
import { createSiteBooking } from "@/lib/booking";
import { runCleanup } from "@/lib/cleanup";
import { db } from "@/lib/db";
import { configProblems, operatorMissing } from "@/lib/readiness";
import { localToUtc } from "@/lib/time";
import { makeBusiness, resetDb } from "./helpers";

const TZ = "Asia/Yekaterinburg";
const DATE = "2026-10-10";
const NOW = localToUtc("2026-10-05", 600, TZ);
const site = (businessId: string, serviceId: string, time: string, phone = "+79990001234") => ({
  businessId, serviceId, date: DATE, time, clientName: "Иван", clientPhone: phone, car: "Kia Rio", comment: "Стук", consentIp: "1.2.3.4", nowMs: NOW,
});

beforeEach(resetDb);
afterAll(() => db.$disconnect());

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? pages(p) : n === "page.tsx" ? [p] : [];
  });
}

describe("каждая страница админки и кабинета сама проверяет вход", () => {
  // Проверка в layout не спасает: при переходах layout не перерисовывается (документация Next.js, «Layouts and auth checks»)
  const root = path.resolve(import.meta.dirname, "../src/app");
  for (const [dir, fn] of [["admin", "requireAdmin()"], ["cabinet", "requireOwner()"]] as const) {
    for (const file of pages(path.join(root, dir))) {
      it(`${path.relative(root, file)} вызывает ${fn}`, () => {
        expect(readFileSync(file, "utf8")).toContain(`await ${fn}`);
      });
    }
  }
});

describe("проверка сертификатов для адресов клиентов", () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret-key-for-tests";
    process.env.ROOT_DOMAIN = "avtoslot.ru";
  });
  afterEach(() => {
    process.env = { ...env };
  });
  const ask = (domain: string, key?: string) =>
    tlsCheck(new NextRequest(`http://app:3000/api/tls-check?${key ? `key=${key}&` : ""}domain=${domain}`, { headers: { "x-forwarded-for": "172.18.0.4" } }));

  it("без ключа или с чужим ключом не отвечает", async () => {
    expect((await ask("avtoslot.ru")).status).toBe(404);
    expect((await ask("avtoslot.ru", "wrong")).status).toBe(404);
  });

  it("с ключом: основной домен и подключённый клиент — да, демо — нет", async () => {
    const biz = await makeBusiness({ slug: "koleso" });
    expect((await ask("avtoslot.ru", "s3cret-key-for-tests")).status).toBe(200);
    expect((await ask("koleso.avtoslot.ru", "s3cret-key-for-tests")).status).toBe(404); // демо
    await db.business.update({ where: { id: biz.id }, data: { status: "trial" } });
    expect((await ask("koleso.avtoslot.ru", "s3cret-key-for-tests")).status).toBe(200);
    expect((await ask("chuzhoi.avtoslot.ru", "s3cret-key-for-tests")).status).toBe(404);
  });
});

describe("запись с сайта", () => {
  it("в демо время занимается, но имя, телефон и машина не сохраняются", async () => {
    const biz = await makeBusiness();
    const b = await createSiteBooking({ ...site(biz.id, biz.services[0].id, "10:00"), withoutPersonalData: true, maxActivePerPhone: 1 });
    const saved = await db.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(saved).toMatchObject({ clientName: null, clientPhone: null, car: null, comment: null, consentIp: null, consentAt: null, status: "active" });
    // С того же номера в демо можно попробовать ещё раз: номер не хранится и не считается
    await createSiteBooking({ ...site(biz.id, biz.services[0].id, "11:00"), withoutPersonalData: true, maxActivePerPhone: 1 });
  });

  it("одна будущая запись на номер в одном сервисе", async () => {
    const biz = await makeBusiness();
    const sid = biz.services[0].id;
    await createSiteBooking({ ...site(biz.id, sid, "10:00"), maxActivePerPhone: 1 });
    await expect(createSiteBooking({ ...site(biz.id, sid, "11:00"), maxActivePerPhone: 1 })).rejects.toMatchObject({ code: "too_many" });
    await createSiteBooking({ ...site(biz.id, sid, "11:00", "+79990005678"), maxActivePerPhone: 1 });
  });

  it("по умолчанию клиент может отменить запись до самого визита", async () => {
    const biz = await makeBusiness();
    expect(biz.cancelHours).toBe(0);
  });
});

describe("готовность к приёму записей", () => {
  it("живой сайт без реквизитов оператора не принимает записи, демо — принимает", () => {
    expect(operatorMissing({ status: "demo", operatorName: null, operatorInn: null })).toBe(false);
    expect(operatorMissing({ status: "trial", operatorName: "ИП Иванов", operatorInn: null })).toBe(true);
    expect(operatorMissing({ status: "active", operatorName: " ", operatorInn: "590000000000" })).toBe(true);
    expect(operatorMissing({ status: "active", operatorName: "ИП Иванов", operatorInn: "590000000000" })).toBe(false);
  });

  it("админка предупреждает о незаполненных настройках сервера", () => {
    const full = { SMARTCAPTCHA_CLIENT_KEY: "ysc1_c", SMARTCAPTCHA_SERVER_KEY: "ysc2_s", PROCESSOR_NAME: "Иванов И. И.", PROCESSOR_INN: "590000000000", PROCESSOR_EMAIL: "a@ya.ru", DB_LOCATION: "Россия, Москва", CRON_SECRET: "x", S3_BUCKET: "b", HEALTHCHECK_URL: "https://hc", CONTACT_TELEGRAM: "igor" };
    expect(configProblems(full)).toEqual([]);
    expect(configProblems({ ...full, SMARTCAPTCHA_SERVER_KEY: "" })[0]).toMatch(/только один ключ/);
    expect(configProblems({ ...full, SMARTCAPTCHA_CLIENT_KEY: "", SMARTCAPTCHA_SERVER_KEY: "" })[0]).toMatch(/Капча выключена/);
    expect(configProblems({ ...full, SMARTCAPTCHA_CLIENT_KEY: "ysc2_s", SMARTCAPTCHA_SERVER_KEY: "ysc1_c" })[0]).toMatch(/перепутанные/);
    expect(configProblems({ ...full, PROCESSOR_INN: "" }).join()).toMatch(/ИНН/);
    expect(configProblems({ ...full, CRON_SECRET: "change-me" }).join()).toMatch(/CRON_SECRET/);
    expect(configProblems({ ...full, S3_BUCKET: "" }).join()).toMatch(/только на этом же сервере/);
  });
});

describe("очистка", () => {
  it("архивное демо старше года удаляется вместе с карточкой лида, бывший клиент с оплатами остаётся", async () => {
    const now = new Date("2026-10-04T00:00:00Z");
    const longAgo = new Date("2025-09-01T00:00:00Z");
    const old = await makeBusiness({ slug: "staroe" });
    await db.business.update({ where: { id: old.id }, data: { status: "archived", demoExpiresAt: longAgo, lead: { create: { status: "refused", contact: "@ivan" } } } });
    const paid = await makeBusiness({ slug: "platil" });
    await db.business.update({ where: { id: paid.id }, data: { status: "archived", demoExpiresAt: longAgo, payments: { create: { amount: 3500, purpose: "Подключение" } } } });
    const fresh = await makeBusiness({ slug: "svezhee" });
    await db.business.update({ where: { id: fresh.id }, data: { status: "archived", demoExpiresAt: new Date("2026-09-01T00:00:00Z") } });

    const r = await runCleanup(now);
    expect(r.demosDeleted).toBe(1);
    expect(await db.business.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await db.lead.count({ where: { businessId: old.id } })).toBe(0);
    expect(await db.business.findUnique({ where: { id: paid.id } })).not.toBeNull();
    expect(await db.business.findUnique({ where: { id: fresh.id } })).not.toBeNull();
  });
});
