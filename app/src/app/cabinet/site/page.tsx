import Link from "next/link";
import { ArrowSquareOut, CaretRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { requireOwner } from "@/lib/auth";
import { readFacts } from "@/lib/business";
import { db } from "@/lib/db";
import { formatDayLong, hhmm, toLocal } from "@/lib/time";
import { deleteException } from "../actions";
import { Card, PageHead, Section } from "../ui";
import { ExceptionForm, HoursForm, SettingsForm } from "./forms";

export default async function SiteEditPage() {
  const { business } = await requireOwner();
  const [services, hours, exceptions] = await Promise.all([
    db.service.findMany({ where: { businessId: business.id }, orderBy: [{ sortOrder: "asc" }] }),
    db.workingHours.findMany({ where: { businessId: business.id } }),
    db.dayException.findMany({ where: { businessId: business.id, date: { gte: toLocal(Date.now(), business.timezone).date } }, orderBy: { date: "asc" } }),
  ]);
  const siteUrl = `/s/${business.slug}`;
  const hoursRows = [1, 2, 3, 4, 5, 6, 7].map((wd) => {
    const h = hours.find((x) => x.weekday === wd);
    return {
      weekday: wd, closed: h ? h.closed : true, open: hhmm(h?.openMin ?? 540), close: hhmm(h?.closeMin ?? 1200),
      breakFrom: h?.breakFromMin != null ? hhmm(h.breakFromMin) : "", breakTo: h?.breakToMin != null ? hhmm(h.breakToMin) : "",
    };
  });
  return (
    <>
      <PageHead title="Сайт">
        <a href={siteUrl} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent">
          Открыть сайт <ArrowSquareOut size={16} />
        </a>
        <p className="mt-2 text-[13.5px] text-zinc-600">Цвет и оформление меняет администратор: напишите ему, если хотите другое.</p>
      </PageHead>

      <Section title="Услуги и цены" action={<Link href="/cabinet/site/service/new" className="inline-flex items-center gap-1 text-[14px] font-semibold text-accent"><Plus size={16} />Добавить</Link>}>
        <Card className="divide-y divide-zinc-100">
          {services.map((s) => (
            <Link key={s.id} href={`/cabinet/site/service/${s.id}`} className="flex items-center justify-between gap-3 px-3.5 py-3">
              <div className={s.active ? "" : "opacity-50"}>
                <div className="text-[14.5px] font-semibold">{s.name}</div>
                <div className="text-[12.5px] text-zinc-500">
                  {s.category}, {s.durationMin} мин{s.active ? "" : ", скрыта"}
                </div>
              </div>
              <span className="flex items-center gap-1 whitespace-nowrap text-[14px] font-semibold">
                {s.priceFrom ? `от ${s.priceFrom.toLocaleString("ru-RU")} ₽` : "бесплатно"} <CaretRight size={16} className="text-zinc-400" />
              </span>
            </Link>
          ))}
        </Card>
      </Section>

      <div id="hours" className="scroll-mt-4">
        <Section title="Часы работы и обед">
          <HoursForm hours={hoursRows} />
        </Section>
      </div>

      <Section title="Праздники и особые дни">
        {exceptions.map((e) => (
          <Card key={e.id} className="flex items-center justify-between p-3.5 text-[14px]">
            <span>
              <b>{formatDayLong(e.date)}</b>
              <span className="block text-zinc-500">{e.closed ? "не работаем" : `${hhmm(e.openMin ?? 0)}-${hhmm(e.closeMin ?? 0)}`}</span>
            </span>
            <form action={deleteException.bind(null, e.id)}>
              <button className="rounded-lg bg-zinc-100 px-3 py-2 text-[13px] font-semibold">Убрать</button>
            </form>
          </Card>
        ))}
        <ExceptionForm today={toLocal(Date.now(), business.timezone).date} />
      </Section>

      <Section title="Тексты и настройки записи">
        <SettingsForm
          s={{
            headline: business.headline ?? "",
            addressNote: business.addressNote ?? "",
            posts: business.posts,
            cancelHours: business.cancelHours,
            horizonDays: business.horizonDays,
            minLeadMin: business.minLeadMin,
            slotStepMin: business.slotStepMin,
            facts: readFacts(business.facts),
          }}
        />
      </Section>
    </>
  );
}
