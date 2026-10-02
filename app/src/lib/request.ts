import { headers } from "next/headers";

/** IP клиента. За Caddy берём первый адрес из X-Forwarded-For. */
export async function clientIp(): Promise<string | undefined> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") ?? undefined;
}
