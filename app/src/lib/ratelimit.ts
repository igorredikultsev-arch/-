import { db } from "./db";

/**
 * Ограничение частоты по ключу в фиксированном окне. Возвращает true, если лимит не превышен.
 * Счётчик хранится в базе, чтобы работать одинаково после перезапуска и на нескольких процессах.
 */
export async function hit(key: string, limit: number, windowSec: number, nowMs = Date.now()): Promise<boolean> {
  const windowStart = new Date(nowMs - windowSec * 1000);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES (${key}, 1, ${new Date(nowMs)})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < ${windowStart} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < ${windowStart} THEN ${new Date(nowMs)} ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;
  return rows[0].count <= limit;
}
