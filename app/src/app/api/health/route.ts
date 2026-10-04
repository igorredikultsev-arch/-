import { db } from "@/lib/db";

/** Жив ли сайт и база. Его раз в 5 минут дёргает cron на сервере, а при успехе отмечается в мониторинге (deploy/schedule.sh). */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
