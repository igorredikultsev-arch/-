import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDayLong, hhmm, toLocal } from "@/lib/time";
import { deleteBlock } from "../actions";
import { Card, PageHead, Section } from "../ui";
import { BlockForm } from "./block-form";

export default async function BlockPage() {
  const { business } = await requireOwner();
  const tz = business.timezone;
  const blocks = await db.block.findMany({ where: { businessId: business.id, endAt: { gt: new Date() } }, orderBy: { startAt: "asc" }, take: 30 });
  return (
    <>
      <PageHead title="Закрыть время">
        <p className="mt-1 text-[14px] text-zinc-600">Обед, свой ремонт, выходной. На сайте это время нельзя будет выбрать.</p>
      </PageHead>
      <BlockForm today={toLocal(Date.now(), tz).date} posts={business.posts} />
      {blocks.length > 0 && (
        <Section title="Уже закрыто">
          {blocks.map((b) => {
            const s = toLocal(b.startAt.getTime(), tz);
            const e = toLocal(b.endAt.getTime(), tz);
            const whole = s.minutes === 0 && (e.minutes === 0 || e.date !== s.date);
            return (
              <Card key={b.id} className="flex items-center justify-between gap-3 p-3.5">
                <div className="text-[14px]">
                  <b>{formatDayLong(s.date)}</b>
                  <div className="text-zinc-500">
                    {whole ? "весь день" : `${hhmm(s.minutes)}-${hhmm(e.minutes)}`}, {b.scope === "all" ? "весь сервис" : "один пост"}
                    {b.reason ? `. ${b.reason}` : ""}
                  </div>
                </div>
                <form action={deleteBlock.bind(null, b.id)}>
                  <button className="rounded-lg bg-zinc-100 px-3 py-2 text-[13px] font-semibold">Открыть</button>
                </form>
              </Card>
            );
          })}
        </Section>
      )}
    </>
  );
}
