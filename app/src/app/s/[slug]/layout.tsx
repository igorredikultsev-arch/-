import "@fontsource-variable/sofia-sans";
import "@fontsource-variable/sofia-sans-extra-condensed";
import "@fontsource-variable/unbounded";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getSiteBusiness, isExampleSlug, decodeKey } from "@/lib/business";
import { onAccent } from "@/lib/color";
import { formatPhone } from "@/lib/phone";
import { isThemeKey, THEME_HEADER, themeAccent } from "@/lib/themes";
import "../site.css";

// Шрифты тем: «Боковина» — Unbounded, «План» — Sofia Sans в двух ширинах, «Такси» — Golos Text из корневого макета.
// Лежат в проекте (fontsource), имена — в переменных --font-* в site.css

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const biz = await getSiteBusiness(decodeKey((await params).slug));
  if (!biz) notFound();
  // Закончившееся демо (в том числе уже убранное очисткой в архив) — понятная страница вместо ошибки 404
  const expiredDemo =
    (biz.status === "demo" && biz.demoExpiresAt && biz.demoExpiresAt.getTime() < Date.now() && !isExampleSlug(biz.slug)) ||
    (biz.status === "archived" && biz.demoExpiresAt);
  if (expiredDemo || biz.status === "archived") {
    return (
      <div className="site t-taxi">
        <div className="page">
          <div className="closed-note">
            <h1 className="h4">{expiredDemo ? "Демо-версия сайта закончилась" : "Сайт больше не работает"}</h1>
            <p>
              {expiredDemo
                ? `Пример сайта для «${biz.name.replace(/[«»"]/g, "")}» был доступен ограниченное время. Чтобы вернуть его или подключить сайт, ответьте на сообщение, в котором пришла ссылка.`
                : `Позвоните в сервис: ${formatPhone(biz.phone)}`}
            </p>
          </div>
        </div>
      </div>
    );
  }
  // В демо владелец смотрит сайт в другом стиле по ссылке ?theme=…, сохранённый стиль при этом не меняется
  const asked = (await headers()).get(THEME_HEADER);
  const theme = biz.status === "demo" && isThemeKey(asked) ? asked : biz.theme;
  const accent = theme === biz.theme ? biz.accent : themeAccent(theme);
  return (
    <div
      className={`site t-${theme}`}
      style={{ "--accent": accent, "--on-accent": onAccent(accent) } as React.CSSProperties}
    >
      <div className="page">
        {/* Приостановленный сайт: главная показывает заглушку (в page.tsx), а страница уже сделанной записи остаётся,
            чтобы водитель мог посмотреть время и отменить визит */}
        {children}
      </div>
    </div>
  );
}
