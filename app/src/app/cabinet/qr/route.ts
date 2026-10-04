import QRCode from "qrcode";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { publicSiteUrl } from "@/lib/site-url";

/** QR-код сайта владельца для печати (табличка у ворот, визитки): SVG, печатается в любом размере без потери качества. */
export async function GET() {
  const user = await getSessionUser();
  if (!user?.businessId) return new Response("Войдите в кабинет", { status: 401 });
  const biz = await db.business.findUnique({ where: { id: user.businessId }, select: { slug: true, customDomain: true, status: true } });
  if (!biz) return new Response("Сервис не найден", { status: 404 });
  const svg = await QRCode.toString(publicSiteUrl(biz.slug, biz.customDomain, biz.status), { type: "svg", margin: 2, errorCorrectionLevel: "M" });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="qr-${biz.slug}.svg"`,
      "Cache-Control": "private, no-store",
    },
  });
}
