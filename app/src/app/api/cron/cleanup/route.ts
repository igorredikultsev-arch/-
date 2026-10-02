import { runCleanup } from "@/lib/cleanup";

/** Вызывается раз в сутки по расписанию: curl -X POST -H "Authorization: Bearer $CRON_SECRET" …/api/cron/cleanup */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === "change-me" || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Forbidden", { status: 403 });
  }
  return Response.json(await runCleanup());
}
