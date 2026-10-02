import { headers } from "next/headers";

/** Префикс ссылок сайта: на поддомене и своём домене — «», по прямой ссылке — «/s/<slug>». */
export async function siteBase(key: string): Promise<string> {
  const host = ((await headers()).get("host") || "").toLowerCase().replace(/:\d+$/, "");
  const root = (process.env.ROOT_DOMAIN || "").toLowerCase();
  const appHost = process.env.APP_URL ? new URL(process.env.APP_URL).hostname.toLowerCase() : "";
  const direct = !host || host === "localhost" || host === "127.0.0.1" || host === root || host === appHost;
  return direct ? `/s/${encodeURIComponent(key)}` : "";
}

export function routeUrl(city: string, address: string, yandexMapsUrl?: string | null) {
  return yandexMapsUrl || `https://yandex.ru/maps/?text=${encodeURIComponent(`${city}, ${address}`)}`;
}

/**
 * Публичный адрес сайта клиента для ссылок из админки и сообщений.
 * Демо живёт на основном домене (/s/<slug>): так не тратится лимит Let's Encrypt
 * на сертификаты поддоменов. Поддомен и свой домен — только у подключённых клиентов.
 */
export function publicSiteUrl(slug: string, customDomain?: string | null, status?: string): string {
  if (customDomain) return `https://${customDomain}`;
  const root = process.env.ROOT_DOMAIN;
  if (root && process.env.NODE_ENV === "production" && status !== "demo") return `https://${slug}.${root}`;
  return `${process.env.APP_URL || "http://localhost:3000"}/s/${slug}`;
}
