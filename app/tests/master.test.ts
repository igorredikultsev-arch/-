// Вход мастера (26 октября, «Конкурент»): календарь только на просмотр, все действия владельца закрыты.
import { beforeEach, describe, expect, it, vi } from "vitest";

// Cookie входа и переход на другую страницу — заглушки: redirect бросает ошибку с адресом, как настоящий
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined), set: () => {}, delete: () => {} }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { requireOwner, requireViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/tokens";
import { makeBusiness, resetDb } from "./helpers";

async function loginAs(role: "owner" | "master", businessId: string, staffId: string | null = null) {
  const user = await db.user.create({ data: { phone: role === "owner" ? "+79990000001" : "+79990000002", passwordHash: "x", role, businessId, staffId } });
  const token = `t-${role}`;
  await db.session.create({ data: { id: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + 86400000) } });
  jar.set("as_session", token);
  return user;
}

describe("вход мастера", () => {
  beforeEach(async () => { jar.clear(); await resetDb(); });

  it("страницы и действия владельца мастеру закрыты: его отправляет в календарь", async () => {
    const biz = await makeBusiness();
    await loginAs("master", biz.id);
    await expect(requireOwner()).rejects.toThrow("REDIRECT /cabinet/week");
  });

  it("календарь мастеру открыт только на просмотр и на его посту", async () => {
    const biz = await makeBusiness();
    const post = await db.staff.create({ data: { businessId: biz.id, name: "Пост 1 · Андронов Александр", color: "#039be5" } });
    await loginAs("master", biz.id, post.id);
    const v = await requireViewer();
    expect(v).toMatchObject({ readOnly: true, masterStaffId: post.id, asAdmin: false });
    expect(v.business.id).toBe(biz.id);
  });

  it("владелец в календаре по-прежнему может всё", async () => {
    const biz = await makeBusiness();
    await loginAs("owner", biz.id);
    await expect(requireOwner()).resolves.toMatchObject({ asAdmin: false });
    await expect(requireViewer()).resolves.toMatchObject({ readOnly: false, masterStaffId: null });
  });
});
