import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { plural } from "@/lib/digest";
import { rub } from "@/lib/pricing";
import { loadStats, PERIODS, type Period, type Stats } from "@/lib/stats";
import { SubHead } from "../ui";

const NAMES: Record<Period, { tab: string; last: string; prev: string }> = {
  7: { tab: "Неделя", last: "за 7 дней", prev: "чем неделей раньше" },
  30: { tab: "Месяц", last: "за 30 дней", prev: "чем месяцем раньше" },
  90: { tab: "3 месяца", last: "за 90 дней", prev: "чем за 3 месяца до этого" },
};

const records = (n: number) => plural(n, "запись", "записи", "записей");

/** Разница с прошлым периодом словами: «на 5 больше, чем неделей раньше». */
function Delta({ now, before, prev }: { now: number; before: number; prev: string }) {
  // В прошлом периоде записей не было (сервис только подключился): сравнивать не с чем
  if (!before) return null;
  const d = now - before;
  const text = d === 0 ? `столько же, сколько ${prev.replace(/^чем /, "")}` : `на ${Math.abs(d)} ${d > 0 ? "больше" : "меньше"}, ${prev}`;
  return <span className={d > 0 ? "font-semibold text-emerald-700" : "text-zinc-500"}>{text}</span>;
}

function Tile({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="grid content-start gap-0.5 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5">
      <b className="whitespace-nowrap text-[22px] leading-tight tabular-nums">{value}</b>
      <span className="text-[14px] font-medium leading-snug">{label}</span>
      {hint && <span className="text-[12.5px] leading-snug text-zinc-500">{hint}</span>}
    </div>
  );
}

/** Столбики по дням (за 3 месяца — по неделям): снизу записи с сайта, сверху добавленные владельцем. Подсказка — при наведении. */
function Chart({ s }: { s: Stats }) {
  const max = Math.max(1, ...s.buckets.map((b) => b.site + b.owner));
  const first = s.buckets[0];
  const last = s.buckets[s.buckets.length - 1];
  return (
    <figure className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <b className="text-[15px]">Записи по {first.label.includes("–") ? "неделям" : "дням"}</b>
        <span className="flex gap-3 text-[12.5px] text-zinc-600">
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-accent" />С сайта</span>
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-zinc-300" />Добавили вы</span>
        </span>
      </figcaption>
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-zinc-200" />
        <span className="pointer-events-none absolute -top-2.5 right-0 bg-white pl-1 text-[11px] tabular-nums text-zinc-400">{max}</span>
        <div className="flex h-36 items-end gap-[2px] border-b border-zinc-300">
          {s.buckets.map((b) => {
            const n = b.site + b.owner;
            return (
              <div key={b.from} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" tabIndex={0} aria-label={`${b.label}: ${n} ${records(n)}, с сайта ${b.site}`}>
                {b.owner > 0 && <div className="rounded-t-[3px] bg-zinc-300" style={{ height: `${(b.owner / max) * 100}%` }} />}
                {b.site > 0 && <div className={`bg-accent ${b.owner ? "mt-[2px]" : "rounded-t-[3px]"}`} style={{ height: `${(b.site / max) * 100}%` }} />}
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[12px] text-white shadow group-hover:block group-focus:block">
                  {b.label}: {n} {records(n)}{b.site ? `, с сайта ${b.site}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-between text-[12px] text-zinc-500">
        <span>{first.label.split(" – ")[0]}</span>
        <span>{last.label.split(" – ").at(-1)}</span>
      </div>
    </figure>
  );
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { business } = await requireOwner();
  const asked = Number((await searchParams).p);
  const period: Period = (PERIODS as readonly number[]).includes(asked) ? (asked as Period) : 30;
  const { cur, prev, ahead } = await loadStats(business, period);
  const name = NAMES[period];
  const share = cur.total ? Math.round((cur.site / cur.total) * 100) : 0;
  const topMax = Math.max(1, ...cur.services.map((x) => x.count));

  return (
    <>
      <SubHead back="/cabinet/more" backLabel="Ещё" title="Статистика">
        Записи по дню визита. «С сайта» — клиенты записались сами, без звонка.
      </SubHead>
      <div className="grid gap-4 px-[18px] pb-6 lg:max-w-3xl lg:px-0">
        <nav aria-label="Период" className="grid grid-cols-3 rounded-xl bg-white p-1 text-[15px] font-semibold ring-1 ring-zinc-200">
          {PERIODS.map((p) => (
            <Link key={p} href={p === 30 ? "/cabinet/stats" : `/cabinet/stats?p=${p}`} aria-current={p === period ? "page" : undefined}
              className={`grid min-h-11 place-items-center rounded-lg ${p === period ? "bg-ink text-white" : "text-zinc-600 hover:text-ink"}`}>
              {NAMES[p].tab}
            </Link>
          ))}
        </nav>

        {cur.total === 0 && cur.cancelled === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-[14.5px] leading-snug text-zinc-600">
            <b className="mb-1 block text-[17px] text-ink">Записей {name.last} пока нет</b>
            Когда клиенты начнут записываться на сайте, здесь будет видно, сколько их пришло и на какие услуги.
            {ahead > 0 && <> Впереди уже {ahead} {records(ahead)}.</>}
          </div>
        ) : (
          <>
            <section className="rounded-2xl bg-ink p-5 text-white">
              <p className="text-[14px] text-white/70">Клиенты записались сами на сайте {name.last}</p>
              <p className="mt-1 text-[44px] font-bold leading-none tabular-nums">{cur.site}</p>
              <p className="mt-2 text-[14.5px] leading-snug text-white/85">
                {share}% от всех {cur.total} {plural(cur.total, "записи", "записей", "записей")}. Каждая такая запись — минус звонок, который нужно принять.
              </p>
            </section>

            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <Tile value={String(cur.total)} label="Всего записей" />
              <Tile value={`≈ ${rub(cur.revenue)}`} label="На сумму" hint="по ценам «от», без отмен и неявок" />
              <Tile value={String(cur.noShow)} label="Не приехали" hint={cur.noShow ? "отмечено в записи" : undefined} />
              <Tile value={String(cur.cancelled)} label="Отменили" />
            </div>
            {(prev.total > 0 || ahead > 0) && (
              <p className="-mt-1 px-1 text-[13.5px] leading-snug text-zinc-600">
                {prev.total > 0 && <>Всего записей <Delta now={cur.total} before={prev.total} prev={name.prev} />. </>}
                {ahead > 0 && <>Впереди уже {ahead} {records(ahead)}.</>}
              </p>
            )}

            <Chart s={cur} />

            {cur.services.length > 0 && (
              <section className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
                <h2 className="text-[15px] font-bold">Популярные услуги</h2>
                <ol className="grid gap-2.5">
                  {cur.services.map((x) => (
                    <li key={x.name} className="grid gap-1">
                      <span className="flex justify-between gap-3 text-[14.5px]">
                        <span className="min-w-0 truncate">{x.name}</span>
                        <b className="shrink-0 tabular-nums">{x.count}</b>
                      </span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                        <span className="block h-full rounded-full bg-ink" style={{ width: `${(x.count / topMax) * 100}%` }} />
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
