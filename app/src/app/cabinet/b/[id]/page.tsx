import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretLeft, Phone } from "@phosphor-icons/react/dist/ssr";
import { requireOwner } from "@/lib/auth";
import { NO_SHOW_LIMIT, noShowCount } from "@/lib/booking";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { formatDateTime, toLocal } from "@/lib/time";
import { Card, Notice, Tag } from "../../ui";
import { BookingActions } from "./booking-actions";
import { StaffSelect } from "./staff-select";

const STATUS = { active: "Активна", cancelled: "Отменена", no_show: "Не приехал", done: "Выполнена" } as const;

export default async function BookingCard({ params }: { params: Promise<{ id: string }> }) {
  const { business } = await requireOwner();
  const b = await db.booking.findFirst({
    where: { id: (await params).id, businessId: business.id },
    include: { createdBy: { select: { name: true, phone: true } } },
  });
  if (!b) notFound();
  const tz = business.timezone;
  const date = toLocal(b.startAt.getTime(), tz).date;
  const [noShows, staff] = await Promise.all([
    b.clientPhone ? noShowCount(db, business.id, b.clientPhone) : 0,
    db.staff.findMany({ where: { businessId: business.id }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true } }),
  ]);
  // Кто внёс запись: клиент сам через сайт или кто-то из кабинета (у старых записей автора нет)
  const author = b.source === "site" ? "Клиент сам, через сайт" : b.createdBy ? b.createdBy.name || formatPhone(b.createdBy.phone) : "Из кабинета";
  const rows: [string, string | null][] = [
    ["Услуга", b.serviceName],
    ["Машина", b.car],
    ["Комментарий", b.comment],
    ["Стоимость", b.priceFrom ? `от ${b.priceFrom.toLocaleString("ru-RU")} ₽` : null],
    ["Статус", b.status === "cancelled" && b.cancelledBy ? `${STATUS[b.status]} ${b.cancelledBy === "client" ? "клиентом" : "вами"}` : STATUS[b.status]],
    ["Внёс", author],
    ["Создана", formatDateTime(b.createdAt.getTime(), tz)],
  ];
  return (
    <div className="grid gap-4 px-3.5 pt-5 lg:px-0">
      <Link href={`/cabinet?date=${date}`} className="-ml-1 inline-flex min-h-10 items-center gap-1 pr-2 text-[14px] font-semibold text-zinc-600">
        <CaretLeft size={16} /> К расписанию
      </Link>
      <div>
        <div className="text-[13.5px] text-zinc-500">{formatDateTime(b.startAt.getTime(), tz)}</div>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-[28px] font-bold leading-tight tracking-tight">
          {b.clientName || "Без имени"} <Tag source={b.source} />
        </h1>
      </div>
      {b.clientPhone && (
        <a href={`tel:${b.clientPhone}`} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 text-base font-semibold text-white">
          <Phone size={20} /> Позвонить {formatPhone(b.clientPhone)}
        </a>
      )}
      <Card className="divide-y divide-zinc-100 px-4">
        {staff.length > 0 && (
          <div className="grid grid-cols-[104px_1fr] items-center gap-3 py-3 text-[14px]">
            <span className="text-zinc-500">Кто делает</span>
            <StaffSelect id={b.id} value={b.staffId && staff.some((s) => s.id === b.staffId) ? b.staffId : ""} staff={staff} />
          </div>
        )}
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[104px_1fr] gap-3 py-3 text-[14px]">
            <span className="text-zinc-500">{k}</span>
            <span className="font-medium">{v}</span>
          </div>
        ))}
      </Card>
      {noShows > 0 && (
        <Notice tone={noShows >= NO_SHOW_LIMIT ? "warn" : "info"}>
          {noShows >= NO_SHOW_LIMIT
            ? `Неявок с этого номера за год: ${noShows}. Записаться на сайте он больше не может, только по телефону. Чтобы снять запрет, поменяйте отметку «Не приехал» у прошлой записи.`
            : "С этого номера уже была неявка за последний год. После второй неявки онлайн-запись с этого номера закроется."}
        </Notice>
      )}
      <BookingActions id={b.id} status={b.status} hasPd={!!(b.clientName || b.clientPhone || b.car || b.comment)} started={b.startAt.getTime() <= Date.now()} />
    </div>
  );
}
