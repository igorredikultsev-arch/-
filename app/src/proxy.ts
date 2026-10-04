import { NextResponse, type NextRequest } from "next/server";
import { THEME_HEADER } from "@/lib/themes";

const SESSION_COOKIE = "as_session"; // то же имя, что в lib/auth.ts

// Маршрутизация по домену:
//   koleso.<ROOT_DOMAIN>/…   → /s/koleso/…        сайт автосервиса на поддомене
//   avtoservis-ivanov.ru/…   → /s/~avtoservis-ivanov.ru/…   собственный домен клиента
//   <ROOT_DOMAIN>, www, APP_URL и localhost — кабинет, админка и прямые ссылки /s/<slug>
const RESERVED = new Set(["www", "app", "admin", "api", "cabinet", "mail"]);

export function proxy(req: NextRequest) {
  // Битый адрес («%» без кода): сразу «не найдено», иначе Next отвечает ошибкой сервера
  try {
    decodeURIComponent(req.nextUrl.pathname);
  } catch {
    return new NextResponse("Страница не найдена", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  // Стиль для предпросмотра демо (?theme=plan) передаём каркасу сайта заголовком; присланный снаружи заголовок не доверяем
  const headers = new Headers(req.headers);
  headers.delete(THEME_HEADER);
  const asked = req.nextUrl.searchParams.get("theme");
  if (asked) headers.set(THEME_HEADER, asked.slice(0, 16));
  const pass = { request: { headers } };

  const root = (process.env.ROOT_DOMAIN || "").toLowerCase();
  const appHost = process.env.APP_URL ? new URL(process.env.APP_URL).host.toLowerCase() : "";
  const host = (req.headers.get("host") || "").toLowerCase().replace(/:\d+$/, "");
  const { pathname } = req.nextUrl;

  // Проверку для Caddy (ключ в адресе) и служебные адреса не переписываем на сайт клиента: Caddy спрашивает по http://app:3000
  if (pathname === "/api/tls-check") return NextResponse.next(pass);

  if (!host || host === "localhost" || host === "127.0.0.1" || host === root || host === appHost.replace(/:\d+$/, "")) {
    // Второй рубеж: без cookie входа в кабинет и админку не пускаем. Основная проверка — на каждой странице
    if ((pathname.startsWith("/admin") || pathname.startsWith("/cabinet")) && !req.cookies.has(SESSION_COOKIE)) {
      const login = req.nextUrl.clone();
      login.pathname = "/login";
      login.search = "";
      return NextResponse.redirect(login);
    }
    return NextResponse.next(pass);
  }

  let key: string | null = null;
  if (root && host.endsWith(`.${root}`)) {
    const sub = host.slice(0, -(root.length + 1));
    if (!sub.includes(".") && !RESERVED.has(sub)) key = sub;
    else return NextResponse.next(pass);
  } else {
    key = `~${host}`;
  }

  // На сайте клиента доступны только страницы сайта и его API
  if (pathname.startsWith("/s/") || pathname.startsWith("/cabinet") || pathname.startsWith("/admin") || pathname.startsWith("/login")) {
    return new NextResponse(null, { status: 404 });
  }
  const url = req.nextUrl.clone();
  url.pathname = pathname.startsWith("/api/s/") ? pathname : `/s/${encodeURIComponent(key)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url, pass);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|icons/|manifest.webmanifest|sw.js).*)"],
};
