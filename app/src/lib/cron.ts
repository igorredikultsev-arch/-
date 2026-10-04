/** Запросы расписания с сервера: заголовок Authorization: Bearer $CRON_SECRET. Без настоящего секрета — запрет всем. */
export function cronAllowed(req: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && secret !== "change-me" && req.headers.get("authorization") === `Bearer ${secret}`;
}
