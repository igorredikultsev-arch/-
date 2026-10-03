import type { NextRequest } from "next/server";
import { getDayLoad } from "@/lib/booking";
import { json, notFound, publicBusiness } from "@/lib/site-api";
import { isDateString } from "@/lib/time";

/** Занятость постов за день: только промежутки времени, без данных клиентов. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const biz = await publicBusiness((await ctx.params).slug);
  if (!biz) return notFound();
  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!isDateString(date)) return json({ error: "Неверный запрос" }, 400);
  return json({ load: await getDayLoad(biz, date) });
}
