import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";

/** Ключ, который знает только Caddy на нашем сервере (deploy/Caddyfile передаёт его в адресе проверки). */
function keyOk(key: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === "change-me" || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Caddy спрашивает перед выпуском сертификата on-demand: можно ли выпустить для этого домена.
 * Разрешаем только основной домен, поддомены подключённых клиентов и их собственные домены.
 * Без ключа не отвечаем, чтобы по этому адресу нельзя было перебирать, какие клиенты есть.
 */
export async function GET(req: NextRequest) {
  if (!keyOk(req.nextUrl.searchParams.get("key"))) return new Response(null, { status: 404 });
  const domain = (req.nextUrl.searchParams.get("domain") || "").toLowerCase();
  const root = (process.env.ROOT_DOMAIN || "").toLowerCase();
  if (!domain || !root) return new Response(null, { status: 404 });
  if (domain === root || domain === `www.${root}`) return new Response(null, { status: 200 });
  const live = { in: ["trial", "active", "suspended"] as ("trial" | "active" | "suspended")[] };
  let ok = false;
  if (domain.endsWith(`.${root}`)) {
    const slug = domain.slice(0, -(root.length + 1));
    ok = !slug.includes(".") && !!(await db.business.findFirst({ where: { slug, status: live }, select: { id: true } }));
  } else {
    ok = !!(await db.business.findFirst({ where: { customDomain: domain, status: live }, select: { id: true } }));
  }
  return new Response(null, { status: ok ? 200 : 404 });
}
