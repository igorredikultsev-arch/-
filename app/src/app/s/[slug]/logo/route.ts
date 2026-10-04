import { db } from "@/lib/db";

/** Картинка логотипа. Адрес меняется при каждой загрузке (?v=…), поэтому браузер может хранить её сколько угодно. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const key = decodeURIComponent((await params).slug);
  const where = key.startsWith("~") ? { customDomain: key.slice(1).toLowerCase() } : { slug: key.toLowerCase() };
  const biz = await db.business.findFirst({ where, select: { status: true, logo: { select: { data: true, mime: true } } } });
  if (!biz?.logo || biz.status === "archived") return new Response(null, { status: 404 });
  return new Response(new Uint8Array(biz.logo.data), {
    headers: {
      "Content-Type": biz.logo.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
