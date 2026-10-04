import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { UNPAID_GRACE_DAYS } from "@/lib/pricing";
import { formatDate } from "@/lib/time";
import { LEAD_LABEL, STATUS_CLS, STATUS_LABEL, THEMES } from "./labels";

const FUNNEL = ["demo_sent", "replied", "interested", "trial", "paid"] as const;
const ended = (d: Date) => d.getTime() < Date.now();
// Когда очистка приостановит сайт без оплаты (оферта, п. 4.1)
const suspendOn = (d: Date) => formatDate(d.getTime() + UNPAID_GRACE_DAYS * 86400000, "Asia/Yekaterinburg");

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ lead?: string; q?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  // Неизвестный этап в адресе (опечатка, старая ссылка) — показываем всё, а не ошибку
  const lead = sp.lead && sp.lead in LEAD_LABEL ? sp.lead : undefined;
  const q = sp.q?.trim().slice(0, 60) ?? "";
  const [all, counts] = await Promise.all([
    db.business.findMany({
      where: {
        ...(lead ? { lead: { status: lead as never } } : q ? {} : { status: { not: "archived" } }),
        // Поиск по названию, адресу и телефону: нужен, когда демо станет много
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { address: { contains: q, mode: "insensitive" as const } }, { phone: { contains: q.replace(/\D/g, "") || q } }] } : {}),
      },
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
  const noRkn = all.filter((b) => b.status === "active" && !b.rknFiledAt);

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

      {(expiring.length > 0 || unpaid.length > 0 || noRkn.length > 0) && (
        <section className="grid gap-2 rounded-2xl bg-orange-50 p-4 text-[14px] text-orange-950">
          <h2 className="font-bold">Нужно внимание</h2>
          {expiring.map((b) => (
            <Link key={b.id} href={`/admin/b/${b.id}`} className="underline">
              {b.name}: {ended(b.trialEndsAt!) ? `пробный период закончился, без оплаты сайт приостановится ${suspendOn(b.trialEndsAt!)}` : "пробный период заканчивается"}
            </Link>
          ))}
          {unpaid.map((b) => (
            <Link key={b.id} href={`/admin/b/${b.id}`} className="underline">
              {b.name}: {ended(b.paidUntil!) ? `не оплачено, без оплаты сайт приостановится ${suspendOn(b.paidUntil!)}` : "скоро конец оплаченного периода"}
            </Link>
          ))}
          {noRkn.map((b) => (
            <Link key={b.id} href={`/admin/b/${b.id}`} className="underline">
              {b.name}: не отмечено уведомление в Роскомнадзор
            </Link>
          ))}
        </section>
      )}

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{lead ? LEAD_LABEL[lead as keyof typeof LEAD_LABEL] : q ? `Поиск: ${q}` : "Все сервисы"}</h2>
          <form className="flex w-full gap-2 sm:w-auto">
            {lead && <input type="hidden" name="lead" value={lead} />}
            <input name="q" defaultValue={q} placeholder="Название, адрес или телефон" aria-label="Поиск сервиса" className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 text-[14px] sm:w-72" />
            <button className="h-10 rounded-xl bg-zinc-100 px-4 text-[14px] font-semibold hover:bg-zinc-200">Найти</button>
          </form>
        </div>
        {(lead || q) && <Link href="/admin" className="justify-self-start text-[14px] font-semibold text-accent">Показать все</Link>}
        {all.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-zinc-200">
            <p className="text-zinc-600">{q || lead ? "Ничего не нашлось." : "Пока пусто. Начните с первого демо."}</p>
            {!q && !lead && (
              <>
                <Link href="/admin/new" className="mt-3 inline-block rounded-xl bg-accent px-4 py-2.5 font-semibold text-white">Новое демо</Link>
                <Link href="/admin/import" className="ml-2 mt-3 inline-block rounded-xl bg-zinc-100 px-4 py-2.5 font-semibold">Загрузить таблицу</Link>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Телефон: карточки вместо широкой таблицы */}
            <ul className="grid gap-2 md:hidden">
              {all.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/b/${b.id}`} className="grid gap-1.5 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 active:bg-zinc-50">
                    <div className="flex items-start justify-between gap-3">
                      <b className="text-[15.5px] leading-tight">{b.name}</b>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-[12px] font-semibold ${STATUS_CLS[b.status]}`}>{STATUS_LABEL[b.status]}</span>
                    </div>
                    <span className="text-[13px] text-zinc-500">{b.city}, {b.address}</span>
                    <span className="text-[13px] text-zinc-600">
                      {b.lead ? LEAD_LABEL[b.lead.status] : ""}
                      {b._count.bookings ? `, записей с сайта ${b._count.bookings}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc-200 md:block">
              <table className="w-full text-left text-[14px]">
                <thead className="text-[12.5px] text-zinc-500">
                  <tr className="border-b border-zinc-100">
                    <th className="px-4 py-2.5 font-medium">Сервис</th>
                    <th className="px-4 py-2.5 font-medium">Статус</th>
                    <th className="px-4 py-2.5 font-medium">Этап</th>
                    <th className="px-4 py-2.5 font-medium">С сайта</th>
                    <th className="px-4 py-2.5 font-medium">Стиль</th>
                    <th className="px-4 py-2.5 font-medium">Канал</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((b) => (
                    <tr key={b.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/b/${b.id}`} className="font-semibold hover:text-accent">{b.name}</Link>
                        <div className="text-[12.5px] text-zinc-500">{b.city}, {b.address}</div>
                      </td>
                      <td className="px-4 py-3"><span className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${STATUS_CLS[b.status]}`}>{STATUS_LABEL[b.status]}</span></td>
                      <td className="px-4 py-3">{b.lead ? LEAD_LABEL[b.lead.status] : ""}</td>
                      <td className="px-4 py-3 tabular-nums">{b._count.bookings}</td>
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
          </>
        )}
      </section>
    </div>
  );
}
