import { beforeEach, describe, expect, it, vi } from "vitest";

// Действие админки вызываем напрямую: вход и кеш Next.js заменяем заглушками
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), requireAdmin: async () => ({ id: "admin" }), audit: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { deleteBusinesses } from "@/app/admin/actions";
import { db } from "@/lib/db";
import { makeBusiness, resetDb } from "./helpers";

const form = (ids: string[]) => {
  const f = new FormData();
  for (const id of ids) f.append("id", id);
  return f;
};

describe("удаление отмеченных сервисов с главной админки", () => {
  beforeEach(resetDb);

  it("удаляет демо и архив, а подключённых и отказы оставляет", async () => {
    const demo = await makeBusiness({ slug: "d1" });
    const archived = await db.business.update({ where: { id: (await makeBusiness({ slug: "d2" })).id }, data: { status: "archived" } });
    const active = await db.business.update({ where: { id: (await makeBusiness({ slug: "d3" })).id }, data: { status: "active" } });
    const refused = await db.business.update({
      where: { id: (await makeBusiness({ slug: "d4" })).id },
      data: { status: "archived", lead: { create: { status: "refused" } } },
    });
    const r = await deleteBusinesses(null, form([demo.id, archived.id, active.id, refused.id, demo.id]));
    expect(r).toEqual({ ok: true, message: "Удалено: 2. Не удалено: 2 (подключённые сервисы и отказы удаляются только из карточки)." });
    expect((await db.business.findMany({ orderBy: { slug: "asc" } })).map((b) => b.slug)).toEqual(["d3", "d4"]);
  });

  it("без отметок — понятная ошибка", async () => {
    expect(await deleteBusinesses(null, form([]))).toEqual({ error: "Отметьте сервисы, которые нужно удалить" });
  });
});
