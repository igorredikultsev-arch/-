import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { UNPAID_GRACE_DAYS } from "@/lib/pricing";
import { phoneQuery } from "@/lib/phone";
import { TERMINATE_AFTER_DAYS, terminationDue } from "@/lib/readiness";
import { formatDate } from "@/lib/time";
import { BusinessList } from "./business-list";
import { LEAD_LABEL } from "./labels";

// «Спросили» (до 6 октября первым сообщением был вопрос) в воронку не входит: демо теперь отправляем сразу
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
  // «Нужно внимание» — отдельным запросом: список ниже ограничен 300 строками и фильтром, а сигналы терять нельзя
  const [all, counts, live] = await Promise.all([
    db.business.findMany({
      where: {
        ...(lead ? { lead: { status: lead as never } } : q ? {} : { status: { not: "archived" } }),
        // Поиск по названию, адресу и телефону: нужен, когда демо станет много
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { address: { contains: q, mode: "insensitive" as const } }, { phone: { contains: phoneQuery(q) } }] } : {}),
      },
      include: { lead: true, _count: { select: { bookings: { where: { source: "site" } } } } },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    db.lead.groupBy({ by: ["status"], _count: true }),
    db.business.findMany({
      where: {
        OR: [
          { status: "trial", trialEndsAt: { lt: new Date(Date.now() + 3 * 86400000) } },
          { status: "active", OR: [{ paidUntil: { lt: new Date(Date.now() + 3 * 86400000) } }, { rknFiledAt: null }] },
          // Приостановлен 60 дней и больше: договор расторгнут, данные пора удалять
          { status: { in: ["suspended", "archived"] }, suspendedAt: { lte: new Date(Date.now() - TERMINATE_AFTER_DAYS * 86400000) } },
        ],
      },
      select: { id: true, name: true, status: true, trialEndsAt: true, paidUntil: true, rknFiledAt: true, suspendedAt: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  // Воронка накопительная: кто дошёл до этапа или дальше
  const reached = FUNNEL.map((s, i) => ({ s, count: FUNNEL.slice(i).reduce((sum, x) => sum + n(x), 0) }));
  const expiring = live.filter((b) => b.status === "trial" && b.trialEndsAt && b.trialEndsAt.getTime() - Date.now() < 3 * 86400000);
  const unpaid = live.filter((b) => b.status === "active" && b.paidUntil && b.paidUntil.getTime() < Date.now() + 3 * 86400000);
  const noRkn = live.filter((b) => b.status === "active" && !b.rknFiledAt);
  const toDestroy = live.flatMap((b) => { const due = terminationDue(b); return due ? [{ ...b, due }] : []; });

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Воронка</h1>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {reached.map((r, i) => (
            <Link key={r.s} href={`/admin?lead=${r.s}`} className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200 hover:ring-accent">
              <div className="text-[28px] font-bold leading-none">{r.count}</div>
              <div className="mt-1 text-[13px] text-zinc-600">{LEAD_LABEL[r.s]}</div>
              {i > 0 && reached[i - 1].count > 0 && (
                <div className="mt-1 text-[12px] text-zinc-500">{Math.round((r.count / reached[i - 1].count) * 100)}% от прошлого этапа</div>
              )}
            </Link>
          ))}
        </div>
        <p className="text-[13px] text-zinc-500">
          Отказов: {n("refused")}. Ещё не писали: {n("new")}.{n("asked") ? ` Спросили по-старому и ждут ответа: ${n("asked")}.` : ""} Если на демо мало кто отвечает, меняйте текст сообщения; если смотрят, но не платят, меняйте предложение.
        </p>
      </section>

      {(expiring.length > 0 || unpaid.length > 0 || noRkn.length > 0 || toDestroy.length > 0) && (
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
          {toDestroy.map((b) => (
            <Link key={b.id} href={`/admin/b/${b.id}?tab=manage`} className="font-semibold text-red-800 underline">
              {b.name}: приостановлен больше {TERMINATE_AFTER_DAYS} дней, договор расторгнут. Удалите данные сайта и клиентов до {formatDate(b.due.deleteBy.getTime(), "Asia/Yekaterinburg")} («В архив», затем «Удалить совсем») и отправьте акт об уничтожении
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
          <BusinessList
            rows={all.map((b) => ({
              id: b.id, name: b.name, city: b.city, address: b.address, status: b.status, theme: b.theme,
              themeChosen: !!b.themeChosenAt, lead: b.lead?.status ?? null, channel: b.lead?.channel ?? null, bookings: b._count.bookings,
            }))}
          />
        )}
      </section>
    </div>
  );
}
