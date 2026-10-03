import { Sofia_Sans, Sofia_Sans_Extra_Condensed, Unbounded } from "next/font/google";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getSiteBusiness, isPublic } from "@/lib/business";
import { onAccent } from "@/lib/color";
import { isThemeKey, THEME_HEADER, themeAccent } from "@/lib/themes";
import "../site.css";

// Шрифты тем: «Боковина» — Unbounded, «План» — Sofia Sans в двух ширинах, «Такси» — Golos Text из корневого макета
const unbounded = Unbounded({ subsets: ["latin", "cyrillic"], weight: ["500", "700", "800"], variable: "--font-unbounded", display: "swap" });
const sofia = Sofia_Sans({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"], variable: "--font-sofia", display: "swap" });
const sofiaCond = Sofia_Sans_Extra_Condensed({ subsets: ["latin", "cyrillic"], weight: ["700", "800", "900"], variable: "--font-sofia-cond", display: "swap" });

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const biz = await getSiteBusiness(decodeURIComponent((await params).slug));
  if (!biz || biz.status === "archived") notFound();
  const expiredDemo = biz.status === "demo" && biz.demoExpiresAt && biz.demoExpiresAt.getTime() < Date.now();
  if (expiredDemo) notFound();
  // В демо владелец смотрит сайт в другом стиле по ссылке ?theme=…, сохранённый стиль при этом не меняется
  const asked = (await headers()).get(THEME_HEADER);
  const theme = biz.status === "demo" && isThemeKey(asked) ? asked : biz.theme;
  const accent = theme === biz.theme ? biz.accent : themeAccent(theme);
  return (
    <div
      className={`site t-${theme} ${unbounded.variable} ${sofia.variable} ${sofiaCond.variable}`}
      style={{ "--accent": accent, "--on-accent": onAccent(accent) } as React.CSSProperties}
    >
      <div className="page">
        {isPublic(biz.status) ? children : <p className="closed-note">Сайт временно недоступен. Позвоните в сервис: {biz.phone}</p>}
      </div>
    </div>
  );
}
