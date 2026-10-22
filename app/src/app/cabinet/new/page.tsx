import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDateString, parseHhmm, toLocal } from "@/lib/time";
import { PageHead } from "../ui";
import { NewBookingForm } from "./new-booking-form";

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ date?: string; time?: string; staff?: string; back?: string }> }) {
  const { business } = await requireOwner();
  const [services, staff] = await Promise.all([
    db.service.findMany({
      where: { businessId: business.id, active: true },
      orderBy: [{ sortOrder: "asc" }],
      select: { id: true, name: true, durationMin: true },
    }),
    db.staff.findMany({
      where: { businessId: business.id },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true, color: true, onStand: true },
    }),
  ]);
  const today = toLocal(Date.now(), business.timezone).date;
  const q = await searchParams;
  // Пришли из календаря нажатием на пустое место: день, время и сотрудник уже выбраны, после записи — обратно в календарь
  const time = q.time && parseHhmm(q.time) != null ? q.time : "";
  const back = q.back === "day" || q.back === "week" ? `/cabinet/week?view=${q.back}` : undefined;
  return (
    <>
      <PageHead title="Новая запись">
        <p className="mt-1 text-[14px] text-zinc-600">Для клиента, который позвонил или приехал. Время сразу станет занятым на сайте.</p>
      </PageHead>
      <NewBookingForm services={services} staff={staff} standPosts={business.standPosts} today={today}
        initialDate={q.date && isDateString(q.date) && q.date >= today ? q.date : today}
        initialTime={time} initialStaff={q.staff ?? ""} back={back} />
    </>
  );
}
