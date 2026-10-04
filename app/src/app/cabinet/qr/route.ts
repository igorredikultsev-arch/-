import QRCode from "qrcode";
import { requireOwner } from "@/lib/auth";
import { publicSiteUrl } from "@/lib/site-url";

/** QR-код сайта владельца для печати (табличка у ворот, визитки): SVG, печатается в любом размере без потери качества. */
export async function GET() {
  // Владелец — свой сервис; администратор — сервис, кабинет которого сейчас открыт
  const { business: biz } = await requireOwner();
  const svg = await QRCode.toString(publicSiteUrl(biz.slug, biz.customDomain, biz.status), { type: "svg", margin: 2, errorCorrectionLevel: "M" });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="qr-${biz.slug}.svg"`,
      "Cache-Control": "private, no-store",
    },
  });
}
