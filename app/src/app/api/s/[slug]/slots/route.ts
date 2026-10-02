import type { NextRequest } from "next/server";
import { getDaySlots } from "@/lib/booking";
import { json, notFound, publicBusiness } from "@/lib/site-api";
import { isDateString } from "@/lib/time";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const biz = await publicBusiness((await ctx.params).slug);
  if (!biz) return notFound();
  const q = req.nextUrl.searchParams;
  const service = biz.services.find((s) => s.id === q.get("service"));
  const date = q.get("date") ?? "";
  if (!service || !isDateString(date)) return json({ error: "Неверный запрос" }, 400);
  const slots = await getDaySlots(biz, date, service.durationMin);
  return json({ slots: slots.map((s) => ({ time: s.time, free: s.free })) });
}
