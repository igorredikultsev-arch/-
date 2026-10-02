import { NextResponse, type NextRequest } from "next/server";

// Маршрутизация по домену:
//   koleso.<ROOT_DOMAIN>/…   → /s/koleso/…        сайт автосервиса на поддомене
//   avtoservis-ivanov.ru/…   → /s/~avtoservis-ivanov.ru/…   собственный домен клиента
//   <ROOT_DOMAIN>, www, APP_URL и localhost — кабинет, админка и прямые ссылки /s/<slug>
const RESERVED = new Set(["www", "app", "admin", "api", "cabinet", "mail"]);

export function proxy(req: NextRequest) {
  const root = (process.env.ROOT_DOMAIN || "").toLowerCase();
  const appHost = process.env.APP_URL ? new URL(process.env.APP_URL).host.toLowerCase() : "";
  const host = (req.headers.get("host") || "").toLowerCase().replace(/:\d+$/, "");
  const { pathname } = req.nextUrl;

  if (!host || host === "localhost" || host === "127.0.0.1" || host === root || host === appHost.replace(/:\d+$/, "")) {
    return NextResponse.next();
  }

  let key: string | null = null;
  if (root && host.endsWith(`.${root}`)) {
    const sub = host.slice(0, -(root.length + 1));
    if (!sub.includes(".") && !RESERVED.has(sub)) key = sub;
    else return NextResponse.next();
  } else {
    key = `~${host}`;
  }

  // На сайте клиента доступны только страницы сайта и его API
  if (pathname.startsWith("/s/") || pathname.startsWith("/cabinet") || pathname.startsWith("/admin") || pathname.startsWith("/login")) {
    return new NextResponse(null, { status: 404 });
  }
  const url = req.nextUrl.clone();
  url.pathname = pathname.startsWith("/api/s/") ? pathname : `/s/${encodeURIComponent(key)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|icons/|manifest.webmanifest).*)"],
};
