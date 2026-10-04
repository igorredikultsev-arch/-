import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { requireAdmin } from "@/lib/auth";
import { configProblems } from "@/lib/readiness";

export const metadata: Metadata = { title: "Админка", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const problems = configProblems();
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 whitespace-nowrap px-4 sm:gap-4">
          <Link href="/admin" className="flex items-center gap-2 font-bold">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-white">А</span> <span className="hidden sm:inline">Автослот</span>
          </Link>
          <nav className="flex gap-1 text-[14px]">
            <Link href="/admin" className="hidden rounded-lg px-3 py-1.5 hover:bg-zinc-100 sm:block">Сервисы</Link>
            <Link href="/admin/import" className="rounded-lg px-3 py-1.5 hover:bg-zinc-100">Из таблицы</Link>
            <Link href="/admin/new" className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-white">Новое демо</Link>
          </nav>
          <form action={logoutAction} className="ml-auto">
            <button className="text-[14px] text-zinc-500 hover:text-ink">Выйти</button>
          </form>
        </div>
      </header>
      {problems.length > 0 && (
        <div className="border-b border-red-200 bg-red-50">
          <ul className="mx-auto grid max-w-5xl gap-1 px-4 py-3 text-[14px] text-red-800">
            <li className="font-semibold">Сервер настроен не до конца (файл .env на сервере):</li>
            {problems.map((p) => (
              <li key={p}>· {p}</li>
            ))}
          </ul>
        </div>
      )}
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
