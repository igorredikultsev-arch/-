import type { Metadata, Viewport } from "next";
import { closeCabinet } from "@/app/admin/actions";
import { requireOwner } from "@/lib/auth";
import { OFFER_EDITION, OFFER_VERSION } from "@/lib/legal";
import { db } from "@/lib/db";
import { rub, SETUP_PRICE, UNPAID_GRACE_DAYS } from "@/lib/pricing";
import { formatDate } from "@/lib/time";
import { OfferGate } from "./offer-gate";
import { publicSiteUrl } from "@/lib/site-url";
import { SupportLink } from "./support";
import { Sidebar, Tabbar } from "./tabbar";

const DAY = 86400000;

/** Напоминание об оплате: за 5 дней до конца срока, после него — когда сайт приостановится, и сама приостановка. */
function billingNotice(b: { status: string; paidUntil: Date | null; timezone: string }, paidBefore: boolean): { tone: "warn" | "error"; text: string } | null {
  if (b.status === "suspended") {
    return { tone: "error", text: "Сайт приостановлен: клиенты не могут записаться онлайн. Чтобы включить его, оплатите абонентскую плату и напишите нам." };
  }
  if (b.status !== "active" || !b.paidUntil) return null;
  const left = b.paidUntil.getTime() - Date.now();
  if (left > 5 * DAY) return null;
  const off = formatDate(b.paidUntil.getTime() + UNPAID_GRACE_DAYS * DAY, b.timezone);
  // Только что подключили, оплаты ещё не записаны: это не просрочка, а ожидание оплаты подключения
  if (!paidBefore) return { tone: "warn", text: `Ждём оплату подключения, ${rub(SETUP_PRICE)}: в неё входит первый месяц. Без оплаты сайт будет принимать записи до ${off}.` };
  return left > 0
    ? { tone: "warn", text: `Оплачено до ${formatDate(b.paidUntil.getTime(), b.timezone)}. Оплатите следующий месяц, чтобы сайт работал без перерыва.` }
    : { tone: "warn", text: `Оплата не поступила. Сайт продолжит принимать записи до ${off}, потом приостановится. Если уже оплатили, напишите нам.` };
}

export const metadata: Metadata = {
  title: "Кабинет",
  robots: { index: false },
  manifest: "/manifest.webmanifest",
  // Иконка на экране iPhone и название под ней; без «приложения на экране» iPhone не показывает уведомления
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Кабинет", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#eef0f3" };

export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  const { asAdmin, business } = await requireOwner();
  const paidBefore = (await db.payment.count({ where: { businessId: business.id } })) > 0;
  const billing = billingNotice(business, paidBefore);
  // Подключённый сервис: владелец принимает действующую редакцию оферты до работы в кабинете. Администратор за него не принимает
  const needOffer = !asAdmin && business.status !== "demo" && business.offerVersion !== OFFER_VERSION;
  return (
    <div className="min-h-dvh bg-paper text-ink lg:flex">
      {!needOffer && <Sidebar name={business.name} siteUrl={publicSiteUrl(business.slug, business.customDomain, business.status)} />}
      <div className="min-w-0 flex-1">
      {asAdmin && (
        <div className="sticky top-0 z-20 bg-ink text-white">
          <form action={closeCabinet} className="mx-auto flex max-w-md items-center lg:max-w-4xl lg:px-10 justify-between gap-3 px-4 py-2.5 text-[13.5px]">
            <span className="min-w-0">{business.name}: вы в кабинете как администратор, изменения сразу видны клиенту</span>
            <button className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 font-semibold">В админку</button>
          </form>
        </div>
      )}
      {billing && (
        <div className="mx-auto max-w-md px-3.5 pt-3 lg:max-w-4xl lg:px-10">
          <p role={billing.tone === "error" ? "alert" : undefined} className={`rounded-xl px-3.5 py-3 text-[13.5px] leading-snug ${billing.tone === "error" ? "bg-red-50 text-red-800" : "bg-orange-50 text-orange-900"}`}>
            {billing.text} <SupportLink />
          </p>
        </div>
      )}
      {needOffer ? (
        <main className="mx-auto max-w-md pb-16 lg:max-w-2xl">
          <OfferGate edition={OFFER_EDITION} name={business.name} />
        </main>
      ) : (
        <>
          <main className="mx-auto max-w-md pb-32 lg:max-w-4xl lg:px-10 lg:pb-16">{children}</main>
          <Tabbar />
        </>
      )}
      </div>
    </div>
  );
}
