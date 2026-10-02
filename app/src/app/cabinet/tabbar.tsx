"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDots, Clock, List, PencilSimple, Plus } from "@phosphor-icons/react";

const tabs = [
  { href: "/cabinet", label: "Сегодня", icon: Clock },
  { href: "/cabinet/week", label: "Неделя", icon: CalendarDots },
  { href: "/cabinet/new", label: "Запись", icon: Plus, fab: true },
  { href: "/cabinet/site", label: "Сайт", icon: PencilSimple },
  { href: "/cabinet/more", label: "Ещё", icon: List },
];

export function Tabbar() {
  const path = usePathname();
  return (
    <nav
      aria-label="Разделы кабинета"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-1.5 pb-3 pt-2">
        {tabs.map((t) => {
          const on =
            t.href === "/cabinet" ? path === "/cabinet" || path.startsWith("/cabinet/b/")
            : t.href === "/cabinet/more" ? path.startsWith("/cabinet/more") || path.startsWith("/cabinet/block")
            : path.startsWith(t.href);
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
