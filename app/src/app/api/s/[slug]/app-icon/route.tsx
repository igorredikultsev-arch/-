import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { iconable, iconBusiness } from "@/lib/app-icon";

const SIZES = [180, 192, 512];

/** Квадратная иконка кабинета из логотипа сервиса (PNG). Без логотипа — общая иконка Автослота. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const asked = Number(req.nextUrl.searchParams.get("size"));
  const size = SIZES.includes(asked) ? asked : 192;
  const biz = await iconBusiness((await ctx.params).slug, true);
  if (!biz?.logo?.data || !iconable(biz.logo.mime)) {
    return Response.redirect(new URL(size === 180 ? "/icons/apple-touch-icon.png" : `/icons/icon-${size === 512 ? 512 : 192}.png`, req.url), 302);
  }
  const src = `data:${biz.logo.mime};base64,${Buffer.from(biz.logo.data).toString("base64")}`;
  // Фон — левый верхний угол того же логотипа, растянутый на весь квадрат: обычно это цвет фона логотипа,
  // и логотип не выглядит прямоугольником на чужом фоне. У прозрачного логотипа сквозь угол виден белый.
  // ponytail: угол логотипа вместо настоящего среднего цвета — если угол пёстрый, фон будет пёстрым; тогда считать цвет по пикселям
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff", position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- картинка внутри генерируемой иконки */}
        <img src={src} alt="" width={size * 8} height={size * 8} style={{ position: "absolute", left: 0, top: 0, objectFit: "cover", objectPosition: "left top" }} />
        {/* eslint-disable-next-line @next/next/no-img-element -- картинка внутри генерируемой иконки */}
        <img src={src} alt="" width={size * 0.86} height={size * 0.86} style={{ objectFit: "contain" }} />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
