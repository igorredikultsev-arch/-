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
