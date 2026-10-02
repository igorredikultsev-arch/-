// Ручной запуск очистки: npm run cron:cleanup
import "dotenv/config";
import { runCleanup } from "../src/lib/cleanup";
import { db } from "../src/lib/db";

runCleanup()
  .then((r) => console.log(r))
  .finally(() => db.$disconnect());
