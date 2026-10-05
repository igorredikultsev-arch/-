import { timingSafeEqual } from "node:crypto";

/** Запросы расписания с сервера: заголовок Authorization: Bearer $CRON_SECRET. Без настоящего секрета — запрет всем. */
export function cronAllowed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === "change-me") return false;
  // Сравнение за одинаковое время: по скорости ответа нельзя подбирать секрет по буквам
  const a = Buffer.from(req.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
