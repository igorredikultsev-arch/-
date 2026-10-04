import { runCleanup } from "@/lib/cleanup";
import { cronAllowed } from "@/lib/cron";

/** Вызывается раз в сутки по расписанию: curl -X POST -H "Authorization: Bearer $CRON_SECRET" …/api/cron/cleanup */
export async function POST(req: Request) {
  if (!cronAllowed(req)) return new Response("Forbidden", { status: 403 });
  return Response.json(await runCleanup());
}
