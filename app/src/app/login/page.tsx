import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { brandContacts } from "@/lib/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Вход в кабинет", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ closed?: string }> }) {
  const closed = (await searchParams).closed !== undefined;
  const user = await getSessionUser();
  // Сервис в архиве: кабинет отправил сюда, обратно в кабинет не пускаем, иначе получится круг
  if (user && !closed) redirect(user.role === "admin" ? "/admin" : "/cabinet");
  const c = brandContacts();
  const contact = c.telegram ? (
    <a href={c.telegram} className="font-semibold text-ink underline underline-offset-2">в Telegram {c.telegramName}</a>
  ) : c.email ? (
    <a href={`mailto:${c.email}`} className="font-semibold text-ink underline underline-offset-2">на {c.email}</a>
  ) : (
    "тому, кто подключал сервис"
  );
  return (
    <main className="min-h-dvh bg-paper px-4 py-12 text-ink">
      <div className="mx-auto grid max-w-sm gap-8">
        <div className="grid gap-2">
          <div className="grid size-12 place-items-center rounded-2xl bg-accent text-xl font-bold text-white" aria-hidden="true">А</div>
          <h1 className="text-3xl font-bold tracking-tight">Вход в кабинет</h1>
          <p className="text-zinc-600">Телефон и пароль выдаются при подключении. Забыли пароль? Напишите {contact}.</p>
        </div>
        {closed && (
          <p role="alert" className="rounded-xl bg-orange-50 px-3.5 py-3 text-[14px] leading-snug text-orange-900">
            Сервис отключён, кабинет больше недоступен. Если это ошибка, напишите {contact}.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
