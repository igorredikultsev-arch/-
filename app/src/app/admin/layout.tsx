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
            <Link href="/admin" className="rounded-lg px-3 py-1.5 hover:bg-zinc-100">Сервисы</Link>
            <Link href="/admin/import" className="hidden rounded-lg px-3 py-1.5 hover:bg-zinc-100 sm:block">Из таблицы</Link>
            <Link href="/admin/new" className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-white">+ Демо</Link>
          </nav>
          <form action={logoutAction} className="ml-auto">
            <button className="text-[14px] text-zinc-500 hover:text-ink">Выйти</button>
          </form>
        </div>
      </header>
      {problems.length > 0 && (
        <div className="border-b border-red-200 bg-red-50">
          <div className="mx-auto max-w-5xl px-4 py-3 text-[14px] text-red-800">
            <p className="font-semibold">Сервер настроен не до конца (файл .env на сервере):</p>
            <ul className="mt-1 grid list-disc gap-1 pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
