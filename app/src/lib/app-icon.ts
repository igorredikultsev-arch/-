// Иконка кабинета на экране телефона: у сервиса с логотипом — его логотип, без логотипа — общая «А» Автослота.
import { decodeKey } from "@/lib/business";
import { db } from "@/lib/db";

/** Сервис для иконки и манифеста кабинета. Кабинет работает и у приостановленного сайта, поэтому не только «публичные».
    Саму картинку (до 700 КБ) читаем только для иконки, манифесту хватает её типа. */
export async function iconBusiness(slug: string, withData = false) {
  const key = decodeKey(slug);
  const biz = await db.business.findFirst({
    where: { slug: key.toLowerCase() },
    select: { name: true, status: true, logoAt: true, logo: { select: { data: withData, mime: true } } },
  });
  return biz && biz.status !== "archived" ? biz : null;
}

/** Нарисовать логотип умеют только PNG и JPEG (WebP картинка иконки не понимает) — иначе остаётся общая иконка. */
export const iconable = (mime: string | undefined) => mime === "image/png" || mime === "image/jpeg";

/** Адрес иконки нужного размера; v меняется с новым логотипом, чтобы телефон не держал старую. */
export const appIconUrl = (slug: string, size: number, logoAt: Date) =>
  `/api/s/${encodeURIComponent(slug)}/app-icon?size=${size}&v=${logoAt.getTime()}`;
