import Link from "next/link";
import { CaretRight, LockSimple, SignOut } from "@phosphor-icons/react/dist/ssr";
import { logoutAction } from "@/app/login/actions";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { vapidKeys } from "@/lib/push";
import { formatDate } from "@/lib/time";
import { Card, PageHead, Section } from "../ui";
import { PasswordForm } from "./password-form";
import { PushToggle } from "./push-toggle";

export default async function MorePage() {
  const { user, business, asAdmin } = await requireOwner();
  const devices = await db.pushSubscription.count({ where: { businessId: business.id } });
  return (
    <>
      <PageHead title="Ещё" kicker={business.name} />
      <div className="grid gap-2 px-3.5">
        <Link href="/cabinet/block">
          <Card className="flex items-center justify-between p-4">
            <span className="flex items-center gap-3 text-[15px] font-semibold"><LockSimple size={22} /> Закрыть время</span>
            <CaretRight size={18} className="text-zinc-400" />
          </Card>
        </Link>
      </div>
      <section id="push" className="scroll-mt-4">
        <Section title="Уведомления о записях">
          <Card className="p-4">
            {asAdmin ? (
              <p className="text-[14px] text-zinc-700">Уведомления включает сам владелец на своём телефоне. Телефонов с уведомлениями: {devices}.</p>
            ) : (
              <PushToggle publicKey={(await vapidKeys()).publicKey} devices={devices} />
            )}
          </Card>
        </Section>
      </section>
      <Section title="Как поставить кабинет на телефон">
        <Card className="grid gap-2 p-4 text-[14px] leading-snug text-zinc-700">
          <p><b>iPhone:</b> откройте кабинет в Safari, нажмите «Поделиться», затем «На экран Домой».</p>
          <p><b>Android:</b> откройте в Chrome, нажмите меню из трёх точек, затем «Добавить на главный экран».</p>
          <p className="text-zinc-500">Кабинет откроется как приложение, без адресной строки.</p>
        </Card>
      </Section>
      {/* Администратор в кабинете клиента не меняет пароль и не выходит отсюда: для этого админка */}
      {!asAdmin && (
        <>
          <Section title="Пароль">
            <PasswordForm />
          </Section>
          <Section title="Аккаунт">
            <Card className="grid gap-3 p-4 text-[14px]">
              <span className="text-zinc-600">Вы вошли как {formatPhone(user.phone)}</span>
              {business.paidUntil && business.status === "active" && (
                <span className="text-zinc-600">Оплачено до {formatDate(business.paidUntil.getTime(), business.timezone)}</span>
              )}
              <form action={logoutAction}>
                <button className="inline-flex items-center gap-2 font-semibold text-red-700"><SignOut size={18} /> Выйти</button>
              </form>
            </Card>
          </Section>
        </>
      )}
    </>
  );
}
