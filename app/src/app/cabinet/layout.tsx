import type { Metadata, Viewport } from "next";
import { closeCabinet } from "@/app/admin/actions";
import { requireOwner } from "@/lib/auth";
import { OFFER_EDITION, OFFER_VERSION } from "@/lib/legal";
import { UNPAID_GRACE_DAYS } from "@/lib/pricing";
import { formatDate } from "@/lib/time";
import { OfferGate } from "./offer-gate";
import { Tabbar } from "./tabbar";

const DAY = 86400000;

/** Напоминание об оплате: за 5 дней до конца срока, после него — когда сайт приостановится, и сама приостановка. */
function billingNotice(b: { status: string; paidUntil: Date | null; timezone: string }): { tone: "warn" | "error"; text: string } | null {
  if (b.status === "suspended") {
    return { tone: "error", text: "Сайт приостановлен: клиенты не могут записаться онлайн. Чтобы включить его, оплатите абонентскую плату и напишите администратору." };
  }
  if (b.status !== "active" || !b.paidUntil) return null;
  const left = b.paidUntil.getTime() - Date.now();
  if (left > 5 * DAY) return null;
  const off = formatDate(b.paidUntil.getTime() + UNPAID_GRACE_DAYS * DAY, b.timezone);
  return left > 0
    ? { tone: "warn", text: `Оплачено до ${formatDate(b.paidUntil.getTime(), b.timezone)}. Оплатите следующий месяц, чтобы сайт работал без перерыва.` }
    : { tone: "warn", text: `Оплата не поступила. Сайт продолжит принимать записи до ${off}, потом приостановится. Напишите администратору, если уже оплатили.` };
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
  const billing = billingNotice(business);
  // Подключённый сервис: владелец принимает действующую редакцию оферты до работы в кабинете. Администратор за него не принимает
  const needOffer = !asAdmin && business.status !== "demo" && business.offerVersion !== OFFER_VERSION;
  return (
    <div className="min-h-dvh bg-paper text-ink">
      {asAdmin && (
        <div className="sticky top-0 z-20 bg-ink text-white">
          <form action={closeCabinet} className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-2.5 text-[13.5px]">
            <span className="min-w-0">{business.name}: вы в кабинете как администратор, изменения сразу видны клиенту</span>
            <button className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 font-semibold">В админку</button>
          </form>
        </div>
      )}
      {billing && (
        <div className="mx-auto max-w-md px-3.5 pt-3">
          <p role={billing.tone === "error" ? "alert" : undefined} className={`rounded-xl px-3.5 py-3 text-[13.5px] leading-snug ${billing.tone === "error" ? "bg-red-50 text-red-800" : "bg-orange-50 text-orange-900"}`}>
            {billing.text}
          </p>
        </div>
      )}
      {needOffer ? (
        <main className="mx-auto max-w-md pb-16">
          <OfferGate edition={OFFER_EDITION} name={business.name} />
        </main>
      ) : (
        <>
          <main className="mx-auto max-w-md pb-32">{children}</main>
          <Tabbar />
        </>
      )}
    </div>
  );
}
