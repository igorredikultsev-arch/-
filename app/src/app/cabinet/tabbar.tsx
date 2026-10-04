"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowSquareOut, CalendarDots, ChartBar, Clock, List, PencilSimple, Plus } from "@phosphor-icons/react";

const tabs = [
  { href: "/cabinet", label: "Сегодня", icon: Clock },
  { href: "/cabinet/week", label: "Неделя", icon: CalendarDots },
  { href: "/cabinet/new", label: "Запись", icon: Plus, fab: true },
  { href: "/cabinet/site", label: "Сайт", icon: PencilSimple },
  { href: "/cabinet/more", label: "Ещё", icon: List },
];

const isOn = (href: string, path: string) =>
  href === "/cabinet" ? path === "/cabinet" || path.startsWith("/cabinet/b/")
  : href === "/cabinet/more" ? path.startsWith("/cabinet/more") || path.startsWith("/cabinet/block") || path.startsWith("/cabinet/stats")
  : path.startsWith(href);

export function Tabbar() {
  const path = usePathname();
  return (
    <nav
      aria-label="Разделы кабинета"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-1.5 pb-3 pt-2">
        {tabs.map((t) => {
          const on = isOn(t.href, path);
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
              className={`grid justify-items-center gap-0.5 text-[11px] ${on ? "font-semibold text-ink" : "text-zinc-500"}`}>
              {t.fab ? (
                <span className="-mt-7 grid size-14 place-items-center rounded-[18px] bg-accent text-white shadow-[0_10px_20px_-6px_rgba(255,106,31,.6)]">
                  <Icon size={28} />
                </span>
              ) : (
                <Icon size={23} weight={on ? "bold" : "regular"} />
              )}
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

const sideTabs = [...tabs.filter((t) => !t.fab && t.href !== "/cabinet/more"), { href: "/cabinet/stats", label: "Статистика", icon: ChartBar }, tabs[tabs.length - 1]];

/** Боковое меню на компьютере вместо нижней панели. */
export function Sidebar({ name, siteUrl }: { name: string; siteUrl: string }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-zinc-200 bg-white px-4 py-6 lg:flex">
      <div className="flex items-center gap-2.5 px-2">
        <span className="grid size-9 place-items-center rounded-xl bg-accent text-[17px] font-bold text-white">А</span>
        <span className="min-w-0">
          <b className="block text-[15px] leading-tight">Кабинет</b>
          <span className="block truncate text-[13px] text-zinc-500" title={name}>{name}</span>
        </span>
      </div>
      <Link href="/cabinet/new" className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-semibold text-white hover:brightness-105">
        <Plus size={20} weight="bold" /> Новая запись
      </Link>
      <nav aria-label="Разделы кабинета" className="mt-4 grid gap-1">
        {sideTabs.map((t) => {
          // На компьютере у статистики свой пункт, поэтому «Ещё» на ней не подсвечивается
          const on = isOn(t.href, path) && !(t.href === "/cabinet/more" && path.startsWith("/cabinet/stats"));
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] ${on ? "bg-paper font-semibold text-ink" : "text-zinc-600 hover:bg-zinc-50 hover:text-ink"}`}>
              <Icon size={21} weight={on ? "bold" : "regular"} /> {t.label}
            </Link>
          );
        })}
      </nav>
      <a href={siteUrl} target="_blank" rel="noopener" className="mt-auto flex min-h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] text-zinc-600 hover:bg-zinc-50 hover:text-ink">
        <ArrowSquareOut size={20} /> Открыть мой сайт
      </a>
    </aside>
  );
}
