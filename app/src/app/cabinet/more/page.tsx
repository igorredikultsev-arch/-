import { Bell, ChartBar, ChatCircleText, DeviceMobile, FileText, Key, LockSimple, SignOut, Wallet } from "@phosphor-icons/react/dist/ssr";
import { logoutAction } from "@/app/login/actions";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { MONTHLY_PRICE, rub } from "@/lib/pricing";
import { plural } from "@/lib/digest";
import { dayBounds } from "@/lib/slots";
import { addDays, formatDate, toLocal } from "@/lib/time";
import { supportHref } from "../support";
import { Group, MenuRow, PageHead } from "../ui";

export default async function MorePage() {
  const { user, business, asAdmin } = await requireOwner();
  const devices = await db.pushSubscription.count({ where: { businessId: business.id } });
  // Для строки «Статистика»: записи с сайта за 30 дней, как на самом экране статистики
  const today = toLocal(Date.now(), business.timezone).date;
  const fromSite = await db.booking.count({
    where: {
      businessId: business.id, source: "site", status: { not: "cancelled" },
      startAt: { gte: new Date(dayBounds(addDays(today, -29), business.timezone).start), lt: new Date(dayBounds(today, business.timezone).end) },
    },
  });
  // «Оплачено до» — только когда оплата уже была: сразу после подключения срок стоит «до сегодня», это ещё не оплата
  const payments = await db.payment.count({ where: { businessId: business.id } });
  const paid = business.status === "active" && business.paidUntil && payments ? formatDate(business.paidUntil.getTime(), business.timezone) : null;
  const support = supportHref();
  return (
    <>
      <PageHead title="Ещё" kicker={business.name} />
      <div className="grid gap-5 px-3.5 lg:px-0">
        <Group>
          <MenuRow href="/cabinet/stats" icon={<ChartBar size={22} />} title="Статистика"
            value={fromSite ? `За 30 дней ${fromSite} ${plural(fromSite, "запись", "записи", "записей")} с сайта` : "Сколько записей приносит сайт"} />
        </Group>

        <Group>
          <MenuRow href="/cabinet/more/push" icon={<Bell size={22} />} title="Уведомления о записях"
            value={devices ? `Включены на ${devices} ${devices === 1 ? "устройстве" : "устройствах"}` : "Выключены"} tone={devices ? undefined : "warn"} />
          <MenuRow href="/cabinet/block" icon={<LockSimple size={22} />} title="Закрыть время" value="Свой ремонт, внеплановый выходной" />
          <MenuRow href="/cabinet/more/install" icon={<DeviceMobile size={22} />} title="Кабинет на экране телефона" value="Открывается как приложение" />
        </Group>

        {paid && (
          <div className="flex min-h-16 items-center gap-3.5 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-paper"><Wallet size={22} /></span>
            <span>
              <span className="block text-[16px] font-semibold leading-tight">Оплачено до {paid}</span>
              <span className="text-[13.5px] text-zinc-500">Абонентская плата {rub(MONTHLY_PRICE)} в месяц</span>
            </span>
          </div>
        )}

        <Group>
          {support && <MenuRow href={support} icon={<ChatCircleText size={22} />} title="Вопросы и помощь" value="Ответим, поможем настроить или поменять сайт" />}
          <MenuRow href="/offer" icon={<FileText size={22} />} title="Договор-оферта" value="Условия работы и оплаты" />
        </Group>

        {/* Администратор в кабинете клиента не меняет пароль и не выходит отсюда: для этого админка */}
        {!asAdmin && (
          <Group>
            <MenuRow href="/cabinet/more/password" icon={<Key size={22} />} title="Сменить пароль" value={`Вход по номеру ${formatPhone(user.phone)}`} />
            <form action={logoutAction}>
              <button className="flex min-h-16 w-full items-center gap-3.5 px-4 py-3 text-left hover:bg-zinc-50">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700"><SignOut size={22} /></span>
                <span className="text-[16px] font-semibold text-red-700">Выйти</span>
              </button>
            </form>
          </Group>
        )}
      </div>
    </>
  );
}
