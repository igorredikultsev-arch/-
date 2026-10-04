import { NextResponse } from "next/server";
import { getSiteBusiness, isPublic, decodeKey } from "./business";

/** Сервис для публичного API: только опубликованные и не просроченные демо. */
export async function publicBusiness(slug: string) {
  const biz = await getSiteBusiness(decodeKey(slug));
  if (!biz || !isPublic(biz.status)) return null;
  if (biz.status === "demo" && biz.demoExpiresAt && biz.demoExpiresAt.getTime() < Date.now()) return null;
  return biz;
}

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export const notFound = () => json({ error: "Сервис не найден" }, 404);
