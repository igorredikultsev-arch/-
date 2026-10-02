import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarPlus, Check, NavigationArrow, X } from "@phosphor-icons/react/dist/ssr";
import { canClientCancel } from "@/lib/booking";
import { getSiteBusiness } from "@/lib/business";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { routeUrl, siteBase } from "@/lib/site-url";
import { formatDateTime, formatDayLong, hhmm, toLocal } from "@/lib/time";
import { CancelForm } from "./cancel-form";

export const metadata: Metadata = { title: "Ваша запись", robots: { index: false, follow: false } };

export default async function BookingPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const key = decodeURIComponent(slug);
  const biz = await getSiteBusiness(key);
  const b = await db.booking.findUnique({ where: { cancelToken: token } });
  if (!biz || !b || b.businessId !== biz.id) notFound();

  const base = await siteBase(key);
  const start = toLocal(b.startAt.getTime(), biz.timezone);
  const cancelled = b.status === "cancelled";
  const canCancel = b.status === "active" && canClientCancel(b.startAt, biz.cancelHours);
  const deadline = formatDateTime(b.startAt.getTime() - biz.cancelHours * 3600000, biz.timezone);
  const minutes = Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60000);

  return (
    <div className="done">
      <div className="tick" aria-hidden="true">
        <span className="ic">{cancelled ? <X /> : <Check />}</span>
      </div>
      <h1 className="h3">{cancelled ? "Запись отменена" : "Вы записаны"}</h1>
      <p>
        {cancelled
          ? "Время освободилось. Если передумаете, запишитесь заново."
          : "Ждём вас. Если планы поменяются, отмените запись на этой странице."}
      </p>
      <div className="ticket">
        <div className="top">
          <div className="when">
            {formatDayLong(start.date)}, {hhmm(start.minutes)}
          </div>
          <div className="what">
            {b.serviceName}, около {minutes} минут
          </div>
        </div>
        <div className="cut" />
        <dl>
          {b.car && (
            <div>
              <dt>Машина</dt>
              <dd>{b.car}</dd>
            </div>
          )}
          <div>
            <dt>Адрес</dt>
            <dd>{biz.address}</dd>
          </div>
          {b.priceFrom ? (
            <div>
              <dt>Стоимость</dt>
              <dd>от {b.priceFrom.toLocaleString("ru-RU")} ₽</dd>
            </div>
          ) : null}
        </dl>
      </div>
      {!cancelled && (
        <div className="two" style={{ marginTop: 0 }}>
          <a className="btn alt" href={`/api/s/${encodeURIComponent(key)}/b/${token}/ics`}>
            <span className="ic"><CalendarPlus /></span>В календарь
          </a>
          <a className="btn" href={routeUrl(biz.city, biz.address, biz.yandexMapsUrl)} target="_blank" rel="noopener noreferrer">
            <span className="ic"><NavigationArrow /></span>Маршрут
          </a>
        </div>
      )}
      {!cancelled && (
        <div className="keep">
          <b>Сохраните эту страницу в закладки.</b>{" "}
          {canCancel
            ? `Отменить онлайн можно до ${deadline.replace(/^./, (c) => c.toLowerCase())}. Позже только по телефону ${formatPhone(biz.phone)}.`
            : `Отменить онлайн уже нельзя. Если не успеваете, позвоните: ${formatPhone(biz.phone)}.`}
        </div>
      )}
      {canCancel && <CancelForm token={token} />}
      <a className="cancel" href={base || "/"}>
        На сайт сервиса
      </a>
    </div>
  );
}
