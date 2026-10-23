import { appIconUrl, iconable, iconBusiness } from "@/lib/app-icon";
import { shortName } from "@/lib/business";

/** Манифест кабинета для «приложения на экране»: название и иконка сервиса вместо общей «А» Автослота.
    Лежит в публичном API, потому что телефон запрашивает манифест без входа в кабинет. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const slug = (await ctx.params).slug;
  const biz = await iconBusiness(slug);
  const logo = biz?.logo && biz.logoAt && iconable(biz.logo.mime) ? biz.logoAt : null;
  const icons = logo
    ? [192, 512].map((s) => ({ src: appIconUrl(slug, s, logo), sizes: `${s}x${s}`, type: "image/png", purpose: "any" }))
    : [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      ];
  const manifest = {
    name: biz ? `${biz.name}: кабинет` : "Кабинет автосервиса",
    short_name: biz ? shortName(biz.name) : "Кабинет",
    start_url: "/cabinet",
    scope: "/cabinet",
    display: "standalone",
    background_color: "#eef0f3",
    theme_color: "#eef0f3",
    lang: "ru",
    icons,
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
