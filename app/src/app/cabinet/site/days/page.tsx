import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDayLong, hhmm, toLocal } from "@/lib/time";
import { deleteException } from "../../actions";
import { Group, SubHead } from "../../ui";
import { ExceptionForm } from "../forms";

export default async function DaysPage() {
  const { business } = await requireOwner();
  const today = toLocal(Date.now(), business.timezone).date;
  const days = await db.dayException.findMany({ where: { businessId: business.id, date: { gte: today } }, orderBy: { date: "asc" } });
  return (
    <>
      <SubHead back="/cabinet/site" backLabel="Сайт" title="Праздники и особые дни">
        Дни, когда сервис закрыт или работает по другим часам. В эти дни сайт предложит только подходящее время.
      </SubHead>
      <div className="grid gap-6 px-[18px] lg:max-w-2xl lg:px-0">
        {days.length > 0 && (
          <Group>
            {days.map((d) => (
              <div key={d.id} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
                <span>
                  <b className="block text-[15.5px]">{formatDayLong(d.date)}</b>
                  <span className={`text-[13.5px] ${d.closed ? "text-orange-700" : "text-zinc-500"}`}>{d.closed ? "Не работаем" : `Работаем ${hhmm(d.openMin ?? 0)}–${hhmm(d.closeMin ?? 0)}`}</span>
                </span>
                <form action={deleteException.bind(null, d.id)}>
                  <button className="min-h-10 rounded-xl px-3 text-[14px] font-semibold text-zinc-600 hover:bg-zinc-100">Убрать</button>
                </form>
              </div>
            ))}
          </Group>
        )}
        <section className="grid gap-3">
          <h2 className="text-[17px] font-bold">Добавить день</h2>
          <ExceptionForm today={today} />
        </section>
      </div>
    </>
  );
}
