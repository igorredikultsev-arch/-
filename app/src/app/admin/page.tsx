import Link from "next/link";
import { db } from "@/lib/db";
import { LEAD_LABEL, STATUS_CLS, STATUS_LABEL, THEMES } from "./labels";

const FUNNEL = ["demo_sent", "replied", "interested", "trial", "paid"] as const;

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const lead = (await searchParams).lead;
  const [all, counts] = await Promise.all([
    db.business.findMany({
      where: lead ? { lead: { status: lead as never } } : { status: { not: "archived" } },
      include: { lead: true, _count: { select: { bookings: { where: { source: "site" } } } } },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    db.lead.groupBy({ by: ["status"], _count: true }),
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  // Воронка накопительная: кто дошёл до этапа или дальше
  const reached = FUNNEL.map((s, i) => ({ s, count: FUNNEL.slice(i).reduce((sum, x) => sum + n(x), 0) }));
  const expiring = all.filter((b) => b.status === "trial" && b.trialEndsAt && b.trialEndsAt.getTime() - Date.now() < 3 * 86400000);
  const unpaid = all.filter((b) => b.status === "active" && b.paidUntil && b.paidUntil.getTime() < Date.now() + 3 * 86400000);

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Воронка</h1>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {reached.map((r, i) => (
            <Link key={r.s} href={`/admin?lead=${r.s}`} className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200 hover:ring-accent">
              <div className="text-[28px] font-bold leading-none">{r.count}</div>
              <div className="mt-1 text-[13px] text-zinc-600">{LEAD_LABEL[r.s]}</div>
              {i > 0 && reached[i - 1].count > 0 && (
                <div className="mt-1 text-[12px] text-zinc-400">{Math.round((r.count / reached[i - 1].count) * 100)}% от прошлого этапа</div>
              )}
            </Link>
          ))}
        </div>
        <p className="text-[13px] text-zinc-500">
          Отказов: {n("refused")}. Не отправлено: {n("new")}. Если мало «Ответил», меняйте текст первого сообщения; если отвечают, но не платят, меняйте предложение.
        </p>
      </section>

      {(expiring.length > 0 || unpaid.length > 0) && (
        <section className="grid gap-2 rounded-2xl bg-orange-50 p-4 text-[14px] text-orange-950">
          <b>Нужно внимание</b>
          {expiring.map((b) => <Link key={b.id} href={`/admin/b/${b.id}`} className="underline">{b.name}: пробный период заканчивается</Link>)}
          {unpaid.map((b) => <Link key={b.id} href={`/admin/b/${b.id}`} className="underline">{b.name}: скоро конец оплаченного периода</Link>)}
        </section>
      )}

      <section className="grid gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">{lead ? LEAD_LABEL[lead as keyof typeof LEAD_LABEL] : "Все сервисы"}</h2>
          {lead && <Link href="/admin" className="text-[14px] text-accent">Показать все</Link>}
        </div>
        {all.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-zinc-200">
            <p className="text-zinc-600">Пока пусто. Начните с первого демо.</p>
            <Link href="/admin/new" className="mt-3 inline-block rounded-xl bg-accent px-4 py-2.5 font-semibold text-white">Новое демо</Link>
            <Link href="/admin/import" className="ml-2 mt-3 inline-block rounded-xl bg-zinc-100 px-4 py-2.5 font-semibold">Загрузить таблицу</Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc-200">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead className="text-[12px] text-zinc-500">
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-2.5 font-medium">Сервис</th>
                  <th className="px-4 py-2.5 font-medium">Статус</th>
                  <th className="px-4 py-2.5 font-medium">Воронка</th>
                  <th className="px-4 py-2.5 font-medium">Записей с сайта</th>
                  <th className="px-4 py-2.5 font-medium">Стиль</th>
                  <th className="px-4 py-2.5 font-medium">Канал</th>
                </tr>
              </thead>
              <tbody>
                {all.map((b) => (
                  <tr key={b.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/b/${b.id}`} className="font-semibold hover:text-accent">{b.name}</Link>
                      <div className="text-[12px] text-zinc-500">{b.city}, {b.address}</div>
                    </td>
                    <td className="px-4 py-3"><span className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${STATUS_CLS[b.status]}`}>{STATUS_LABEL[b.status]}</span></td>
                    <td className="px-4 py-3">{b.lead ? LEAD_LABEL[b.lead.status] : ""}</td>
                    <td className="px-4 py-3">{b._count.bookings}</td>
                    <td className="px-4 py-3">
                      {THEMES.find((t) => t.value === b.theme)?.label}
                      {b.themeChosenAt && <div className="text-[12px] font-semibold text-emerald-700">выбрал владелец</div>}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{b.lead?.channel || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
