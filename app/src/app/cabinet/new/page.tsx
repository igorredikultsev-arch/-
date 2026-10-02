import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDateString, toLocal } from "@/lib/time";
import { PageHead } from "../ui";
import { NewBookingForm } from "./new-booking-form";

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { business } = await requireOwner();
  const services = await db.service.findMany({
    where: { businessId: business.id, active: true },
    orderBy: [{ sortOrder: "asc" }],
    select: { id: true, name: true, durationMin: true },
  });
  const today = toLocal(Date.now(), business.timezone).date;
  const q = (await searchParams).date;
  return (
    <>
      <PageHead title="Новая запись">
        <p className="mt-1 text-[14px] text-zinc-600">Для клиента, который позвонил. Время сразу станет занятым на сайте.</p>
      </PageHead>
      <NewBookingForm services={services} today={today} initialDate={q && isDateString(q) && q >= today ? q : today} />
    </>
  );
}
