import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { findPhone, formatPhone } from "@/lib/phone";
import { ensureStaff } from "@/lib/staff";
import { hhmm, toLocal } from "@/lib/time";
import { NewBookingForm } from "../../../new/new-booking-form";
import { SubHead } from "../../../ui";

export default async function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { business } = await requireOwner();
  const b = await db.booking.findFirst({ where: { id: (await params).id, businessId: business.id } });
  if (!b) notFound();
  await ensureStaff(business);
  const [services, staff] = await Promise.all([
    db.service.findMany({ where: { businessId: business.id, active: true }, orderBy: [{ sortOrder: "asc" }], select: { id: true, name: true, durationMin: true } }),
    db.staff.findMany({ where: { businessId: business.id }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true, color: true, onStand: true } }),
  ]);
  const tz = business.timezone;
  const start = toLocal(b.startAt.getTime(), tz);
  const today = toLocal(Date.now(), tz).date;
  // Услугу убрали из списка: показываем её как была, чтобы при сохранении она не сменилась на первую в списке
  const list = b.serviceId && !services.some((s) => s.id === b.serviceId)
    ? [{ id: b.serviceId, name: b.serviceName, durationMin: (b.endAt.getTime() - b.startAt.getTime()) / 60000 }, ...services]
    : services;
  return (
    <>
      <SubHead back={`/cabinet/b/${b.id}`} backLabel="Запись" title="Изменить запись" />
      <NewBookingForm
        services={list}
        staff={staff}
        standPosts={business.standPosts}
        today={start.date < today ? start.date : today}
        initialDate={start.date}
        initialTime={hhmm(start.minutes)}
        edit={{
          id: b.id,
          custom: !b.serviceId,
          // Запись одним полем: имя, машина, телефон и комментарий старых записей переходят в текст, чтобы не потерялись
          title: b.serviceId ? "" : [b.serviceName, b.clientName, b.car, b.comment, b.clientPhone && !findPhone(b.serviceName) ? formatPhone(b.clientPhone) : null].filter(Boolean).join(", "),
          length: Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60000),
          serviceId: b.serviceId ?? "",
          staffId: b.staffId ?? "",
          name: b.clientName ?? "",
          phone: b.clientPhone ? formatPhone(b.clientPhone) : "",
          comment: b.comment ?? "",
        }}
      />
    </>
  );
}
