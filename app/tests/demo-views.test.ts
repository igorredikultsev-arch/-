import { beforeEach, describe, expect, it, vi } from "vitest";

// Вход и адрес клиента берутся из запроса Next.js: в тесте подменяем
const session = vi.hoisted(() => ({ role: null as null | "admin" | "owner" }));
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getSessionUser: async () => (session.role ? { role: session.role } : null) }));
vi.mock("@/lib/request", () => ({ clientIp: async () => "203.0.113.5" }));

import { POST } from "@/app/api/s/[slug]/view/route";
import { db } from "@/lib/db";
import { deviceOf, isBotUa, summaryText, timesText, viewSummaries, whenText } from "@/lib/demo-views";
import { makeBusiness, resetDb } from "./helpers";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 YaBrowser/24.10 Safari/537.36";

const send = (slug: string, kind: unknown, ua = IPHONE) =>
  POST(new Request(`http://localhost/api/s/${slug}/view`, { method: "POST", body: JSON.stringify({ kind }), headers: { "user-agent": ua } }) as never, {
    params: Promise.resolve({ slug }),
  });

describe("кто открыл демо", () => {
  beforeEach(async () => {
    await resetDb();
    session.role = null;
  });

  it("превью мессенджеров и роботы не считаются, встроенные браузеры приложений считаются", () => {
    expect(isBotUa("TelegramBot (like TwitterBot)")).toBe(true);
    expect(isBotUa("vkShare; +http://vk.com/dev/Share")).toBe(true);
    expect(isBotUa("WhatsApp/2.23.20.0")).toBe(true);
    expect(isBotUa("Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)")).toBe(true);
    expect(isBotUa("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/129.0 Safari/537.36")).toBe(true);
    expect(isBotUa("")).toBe(true);
    expect(isBotUa(`${IPHONE.replace("Safari/604.1", "")}Telegram-iOS/11.2`)).toBe(false);
    expect(isBotUa("Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36 Telegram-Android/11.2.3")).toBe(false);
    expect(isBotUa("Mozilla/5.0 (Linux; Android 13; CUBOT_X30) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36 YandexSearch/24.10")).toBe(false);
    expect(deviceOf(IPHONE)).toBe("phone");
    expect(deviceOf(DESKTOP)).toBe("desktop");
  });

  it("открытие владельцем пишется, админ, робот, подключённый сервис и чепуха — нет", async () => {
    const demo = await makeBusiness({ slug: "demo1" });
    const active = await db.business.update({ where: { id: (await makeBusiness({ slug: "live1" })).id }, data: { status: "active" } });

    expect((await send("demo1", "open")).status).toBe(204);
    expect((await send("demo1", "style", DESKTOP)).status).toBe(204);
    expect((await send("demo1", "open", "TelegramBot (like TwitterBot)")).status).toBe(204);
    expect((await send("demo1", "hack")).status).toBe(400);
    expect((await send("live1", "open")).status).toBe(204);
    session.role = "admin";
    expect((await send("demo1", "open")).status).toBe(204);
    expect((await send("nope", "open")).status).toBe(404);

    const rows = await db.demoView.findMany({ orderBy: { kind: "asc" } });
    expect(rows.map((r) => [r.businessId, r.kind, r.device])).toEqual([
      [demo.id, "open", "phone"],
      [demo.id, "style", "desktop"],
    ]);
    expect(await db.demoView.count({ where: { businessId: active.id } })).toBe(0);
  });

  it("сводка для админки: сколько раз, когда и с чего", async () => {
    const b = await makeBusiness({ slug: "demo2" });
    const now = Date.parse("2026-10-09T10:00:00Z"); // 15:00 в Перми
    await db.demoView.createMany({
      data: [
        { businessId: b.id, kind: "open", device: "phone", at: new Date("2026-10-08T04:30:00Z") },
        { businessId: b.id, kind: "style", device: "phone", at: new Date("2026-10-08T04:31:00Z") },
        { businessId: b.id, kind: "open", device: "desktop", at: new Date("2026-10-09T09:05:00Z") },
      ],
    });
    const s = (await viewSummaries([b.id, "missing"])).get(b.id)!;
    expect(s).toMatchObject({ opens: 2, styles: 1, phone: true, desktop: true });
    expect(summaryText(s, now)).toBe("2 раза, последний раз сегодня в 14:05");
    expect(whenText(s.first, now)).toBe("вчера в 09:30");
    expect(whenText(new Date("2026-10-01T15:00:00Z"), now)).toBe("1 октября в 20:00");
    expect([1, 2, 5, 12, 22].map(timesText)).toEqual(["1 раз", "2 раза", "5 раз", "12 раз", "22 раза"]);
    // Удалили демо — отметки уходят вместе с ним
    await db.business.delete({ where: { id: b.id } });
    expect(await db.demoView.count()).toBe(0);
  });
});
