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
