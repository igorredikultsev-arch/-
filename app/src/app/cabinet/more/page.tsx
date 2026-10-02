import Link from "next/link";
import { CaretRight, LockSimple, SignOut } from "@phosphor-icons/react/dist/ssr";
import { logoutAction } from "@/app/login/actions";
import { requireOwner } from "@/lib/auth";
import { formatPhone } from "@/lib/phone";
import { Card, PageHead, Section } from "../ui";
import { PasswordForm } from "./password-form";

export default async function MorePage() {
  const { user, business } = await requireOwner();
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
      <Section title="Как поставить кабинет на телефон">
        <Card className="grid gap-2 p-4 text-[14px] leading-snug text-zinc-700">
          <p><b>iPhone:</b> откройте кабинет в Safari, нажмите «Поделиться», затем «На экран Домой».</p>
          <p><b>Android:</b> откройте в Chrome, нажмите меню из трёх точек, затем «Добавить на главный экран».</p>
          <p className="text-zinc-500">Кабинет откроется как приложение, без адресной строки.</p>
        </Card>
      </Section>
      <Section title="Пароль">
        <PasswordForm />
      </Section>
      <Section title="Аккаунт">
        <Card className="grid gap-3 p-4 text-[14px]">
          <span className="text-zinc-600">Вы вошли как {formatPhone(user.phone)}</span>
          <form action={logoutAction}>
            <button className="inline-flex items-center gap-2 font-semibold text-red-700"><SignOut size={18} /> Выйти</button>
          </form>
        </Card>
      </Section>
    </>
  );
}
