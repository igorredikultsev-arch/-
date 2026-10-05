import type { Business, Lead } from "@prisma/client";
import { db } from "./db";
import type { DemoInput } from "./demo-import";

export type ImportMatch =
  | { kind: "new" }
  | { kind: "exists"; biz: Business & { lead: Lead | null } }
  | { kind: "skip"; biz: Business & { lead: Lead | null }; reason: string };

/**
 * Есть ли сервис из таблицы уже в базе, в том числе в архиве. Отказавшимся повторно не пишем (карточка с отказом —
 * стоп-лист на год, см. cleanup.ts), архивное демо не создаём заново: повторная загрузка той же таблицы ничего не задваивает.
 */
export async function matchForImport(d: Pick<DemoInput, "name" | "address" | "twoGisUrl">): Promise<ImportMatch> {
  const found = await db.business.findMany({
    where: { OR: [...(d.twoGisUrl ? [{ twoGisUrl: d.twoGisUrl }] : []), { name: d.name, address: d.address }] },
    include: { lead: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const refused = found.find((b) => b.lead?.status === "refused");
  if (refused) return { kind: "skip", biz: refused, reason: "отказался, повторно не пишем" };
  const live = found.find((b) => b.status !== "archived");
  if (live) return { kind: "exists", biz: live };
  if (found[0]) return { kind: "skip", biz: found[0], reason: "демо уже было, сейчас в архиве" };
  return { kind: "new" };
}
