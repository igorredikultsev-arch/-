import type { NextRequest } from "next/server";
import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { hit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";
import { json, notFound, publicBusiness } from "@/lib/site-api";
import { isThemeKey, themeAccent } from "@/lib/themes";

/** Владелец выбирает стиль сайта в демо. Только для демо: у подключённых сервисов стиль меняет администратор. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const biz = await publicBusiness((await ctx.params).slug);
  if (!biz) return notFound();
  if (biz.status !== "demo") return json({ error: "Стиль меняет администратор" }, 403);
  const ip = await clientIp();
  if (!(await hit(`theme:${biz.id}:${ip ?? "?"}`, 20, 3600))) return json({ error: "Слишком часто. Попробуйте позже" }, 429);
  const body = await req.json().catch(() => null);
  const theme = body?.theme;
  if (!isThemeKey(theme)) return json({ error: "Неизвестный стиль" }, 400);
  await db.business.update({
    where: { id: biz.id },
    data: { theme, accent: theme === biz.theme ? biz.accent : themeAccent(theme), themeChosenAt: new Date() },
  });
  await audit("site.theme_chosen", { businessId: biz.id, details: { theme } }).catch(() => {});
  return json({ ok: true });
}
