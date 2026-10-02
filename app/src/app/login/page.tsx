import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Вход в кабинет", robots: { index: false } };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/cabinet");
  return (
    <main className="min-h-dvh bg-paper px-4 py-12 text-ink">
      <div className="mx-auto grid max-w-sm gap-8">
        <div className="grid gap-2">
          <div className="grid size-12 place-items-center rounded-2xl bg-accent text-xl font-bold text-white" aria-hidden="true">А</div>
          <h1 className="text-3xl font-bold tracking-tight">Вход в кабинет</h1>
          <p className="text-zinc-600">Телефон и пароль выдаются при подключении. Забыли пароль? Напишите тому, кто подключал сервис.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
