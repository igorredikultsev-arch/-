import { db } from "@/lib/db";

/**
 * Жив ли сайт и база. Его раз в 5 минут дёргает cron на сервере, а при успехе отмечается в мониторинге (deploy/schedule.sh);
 * по нему же update.sh решает, запустилась ли новая версия.
 * Читается настоящая строка сервиса со всеми полями, а не «SELECT 1»: так видно и то, что код не совпадает со схемой базы
 * (например, после отката версии на уже обновлённую базу), при котором сайты сервисов отдают ошибку.
 */
export async function GET() {
  try {
    await db.business.findFirst();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
