import { cache } from "react";
import { db } from "./db";

export const PUBLIC_STATUSES = ["demo", "trial", "active"] as const;

/** Сервис по адресу сайта. «~host» — собственный домен клиента (см. proxy.ts). */
export const getSiteBusiness = cache(async (key: string) => {
  const where = key.startsWith("~") ? { customDomain: key.slice(1).toLowerCase() } : { slug: key.toLowerCase() };
  return db.business.findFirst({
    where,
    include: {
      services: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      hours: { orderBy: { weekday: "asc" } },
      exceptions: true,
    },
  });
});

export type SiteBusiness = NonNullable<Awaited<ReturnType<typeof getSiteBusiness>>>;

export function isPublic(status: string) {
  return (PUBLIC_STATUSES as readonly string[]).includes(status);
}

export type Fact = { value: string; label: string };
export function readFacts(v: unknown): Fact[] {
  if (!Array.isArray(v)) return [];
  return v.filter((f): f is Fact => typeof f?.value === "string" && typeof f?.label === "string").slice(0, 3);
}

/** Ключ сайта из адреса. Битый адрес («%» без кода) — пустая строка, то есть «не найдено», а не ошибка сервера. */
export function decodeKey(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return "";
  }
}

/** Пример сайта с главной avtoslot.ru (EXAMPLE_SLUG): демо, у которого не кончается срок, иначе ссылка с главной однажды умрёт. */
export function isExampleSlug(slug: string) {
  const ex = (process.env.EXAMPLE_SLUG || "").trim();
  return !!ex && slug === ex;
}

/**
 * Короткое имя для шапки «Такси»: «Шиномонтаж «Колесо»» → «Колесо». Название в кавычках главнее;
 * без кавычек убирается вид работ в начале, только если дальше идёт имя с заглавной («Шиномонтаж и мойка» остаётся как есть).
 */
export function shortName(name: string): string {
  const quoted = name.match(/«([^»]+)»/)?.[1] ?? name.match(/"([^"]+)"/)?.[1];
  const rest = name.replace(/^(?:шиномонтаж|автосервис|автотехцентр)\s+/i, "");
  const s = (quoted ?? (/^[A-ZА-ЯЁ0-9]/.test(rest) ? rest : name)).replace(/[«»"]/g, "").trim();
  return s || name;
}
