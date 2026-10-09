import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isViewKind, recordDemoView } from "@/lib/demo-views";
import { hit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";
import { notFound, publicBusiness } from "@/lib/site-api";

/** Демо открыли (kind: open) или посмотрели в другом стиле (style). Пишет страница демо после загрузки, см. lib/demo-views.ts. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const biz = await publicBusiness((await ctx.params).slug);
  if (!biz) return notFound();
  // Страница отправляет отметку через sendBeacon: тело приходит текстом
  const body = await req.text().then((t) => JSON.parse(t)).catch(() => null);
  if (!isViewKind(body?.kind)) return new Response(null, { status: 400 });
  // Одна вкладка с перезагрузками — одна отметка (это решает страница), а лимит не даёт накрутить счётчик
  const ip = await clientIp();
  if (!(await hit(`view:${biz.id}:${ip ?? "?"}`, 30, 3600))) return new Response(null, { status: 204 });
  const user = await getSessionUser().catch(() => null);
  await recordDemoView(biz, { kind: body.kind, ua: req.headers.get("user-agent") ?? "", admin: user?.role === "admin" });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
