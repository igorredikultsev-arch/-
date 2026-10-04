import { cronAllowed } from "@/lib/cron";
import { runDigest } from "@/lib/digest";

/** Утренние сводки владельцам. Расписание на сервере зовёт каждый час изнутри контейнера (deploy/schedule.sh). */
export async function POST(req: Request) {
  if (!cronAllowed(req)) return new Response("Forbidden", { status: 403 });
  return Response.json(await runDigest());
}
