import type { NextRequest } from "next/server";
import { getHorizonSummary } from "@/lib/booking";
import { json, notFound, publicBusiness } from "@/lib/site-api";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const biz = await publicBusiness((await ctx.params).slug);
  if (!biz) return notFound();
  const service = biz.services.find((s) => s.id === req.nextUrl.searchParams.get("service"));
  if (!service) return json({ error: "Выберите услугу" }, 400);
  return json({ days: await getHorizonSummary(biz, service.durationMin) });
}
