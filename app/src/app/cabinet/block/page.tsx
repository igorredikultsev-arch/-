import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDayLong, hhmm, isDateString, toLocal } from "@/lib/time";
import { deleteBlock } from "../actions";
import { Group, SubHead } from "../ui";
import { BlockForm } from "./block-form";

export default async function BlockPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { business } = await requireOwner();
  const tz = business.timezone;
  const today = toLocal(Date.now(), tz).date;
  const q = (await searchParams).date;
  const date = q && isDateString(q) && q >= today ? q : today;
  const blocks = await db.block.findMany({ where: { businessId: business.id, endAt: { gt: new Date() } }, orderBy: { startAt: "asc" }, take: 30 });
  return (
    <>
      <SubHead back={date === today ? "/cabinet" : `/cabinet?date=${date}`} backLabel="Записи" title="Закрыть время">
        Свой ремонт, учёба, внеплановый выходной. На сайте это время нельзя будет выбрать.
      </SubHead>
      <BlockForm today={today} date={date} posts={business.posts} />
      {blocks.length > 0 && (
        <section className="grid gap-2 px-[18px] pt-6 lg:max-w-2xl lg:px-0">
          <h2 className="text-[17px] font-bold">Уже закрыто</h2>
          <Group>
          {blocks.map((b) => {
            const s = toLocal(b.startAt.getTime(), tz);
            const e = toLocal(b.endAt.getTime(), tz);
            const whole = s.minutes === 0 && (e.minutes === 0 || e.date !== s.date);
            return (
              <div key={b.id} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
                <div className="text-[14px]">
                  <b className="text-[15.5px]">{formatDayLong(s.date)}</b>
                  <div className="text-zinc-500">
                    {whole ? "весь день" : `${hhmm(s.minutes)}-${hhmm(e.minutes)}`}, {b.scope === "all" ? "весь сервис" : "один пост"}
                    {b.reason ? `. ${b.reason}` : ""}
                  </div>
                </div>
                <form action={deleteBlock.bind(null, b.id)}>
                  <button className="min-h-10 rounded-xl px-3 text-[14px] font-semibold text-zinc-600 hover:bg-zinc-100">Открыть снова</button>
                </form>
              </div>
            );
          })}
          </Group>
        </section>
      )}
    </>
  );
}
