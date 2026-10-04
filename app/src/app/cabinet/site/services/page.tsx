import Link from "next/link";
import { CaretRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Group, SubHead } from "../../ui";

const dur = (m: number) => (m < 60 ? `${m} мин` : m % 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m / 60} ч`);

export default async function ServicesPage() {
  const { business } = await requireOwner();
  const services = await db.service.findMany({ where: { businessId: business.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const groups = [...new Set(services.map((s) => s.category))];
  return (
    <>
      <SubHead back="/cabinet/site" backLabel="Сайт" title="Услуги и цены">
        Клиент выбирает услугу при записи, а сайт по длительности считает свободное время.
      </SubHead>
      <div className="grid gap-5 px-[18px] lg:px-0">
        <Link href="/cabinet/site/service/new" className="flex min-h-13 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 text-[15.5px] font-semibold text-ink hover:border-accent hover:text-accent">
          <Plus size={18} weight="bold" /> Добавить услугу
        </Link>
        {groups.map((g) => (
          <section key={g} className="grid gap-2">
            <h2 className="px-1 text-[14px] font-semibold text-zinc-500">{g}</h2>
            <Group>
              {services.filter((s) => s.category === g).map((s) => (
                <Link key={s.id} href={`/cabinet/site/service/${s.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                  <span className={`min-w-0 flex-1 ${s.active ? "" : "opacity-50"}`}>
                    <span className="block text-[15.5px] font-semibold leading-tight">{s.name}</span>
                    <span className="text-[13.5px] text-zinc-500">{dur(s.durationMin)}{s.active ? "" : ", скрыта с сайта"}</span>
                  </span>
                  <span className="whitespace-nowrap text-[15px] font-semibold tabular-nums">{s.priceFrom ? `от ${s.priceFrom.toLocaleString("ru-RU")} ₽` : "бесплатно"}</span>
                  <CaretRight size={18} className="shrink-0 text-zinc-400" />
                </Link>
              ))}
            </Group>
          </section>
        ))}
      </div>
    </>
  );
}
