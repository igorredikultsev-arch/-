// Общие элементы кабинета. Крупно и контрастно: владелец смотрит на ходу, иногда в перчатках.
import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";

export function PageHead({ kicker, title, children }: { kicker?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="px-[18px] pb-4 pt-6 lg:px-0 lg:pt-8">
      {kicker && <div className="text-[13.5px] text-zinc-500">{kicker}</div>}
      <h1 className="mt-0.5 text-[30px] font-bold leading-tight tracking-tight">{title}</h1>
      {children}
    </header>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-zinc-200 bg-white ${className}`}>{children}</div>;
}

export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="grid gap-2 px-3.5 pt-5 lg:px-0">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[13px] font-semibold text-zinc-500">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export const inputCls =
  "h-12 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-accent";
export const btnPrimary =
  "inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 text-base font-semibold text-white disabled:opacity-60 active:translate-y-px";
export const btnSecondary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-zinc-200/70 px-4 py-3 text-[15px] font-semibold text-ink disabled:opacity-60 active:translate-y-px";

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="grid gap-1.5">
      <span className="text-[13px] font-semibold text-zinc-600">{label}</span>
      {children}
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: React.ReactNode }) {
  const cls = {
    info: "bg-zinc-100 text-zinc-700",
    warn: "bg-orange-50 text-orange-900",
    error: "bg-red-50 text-red-800",
    ok: "bg-emerald-50 text-emerald-900",
  }[tone];
  return <div role={tone === "error" ? "alert" : undefined} className={`rounded-xl px-3.5 py-3 text-[13.5px] leading-snug ${cls}`}>{children}</div>;
}

export function Tag({ source }: { source: "site" | "owner" }) {
  return source === "site" ? (
    <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[11px] font-semibold text-orange-800">сайт</span>
  ) : (
    <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-600">телефон</span>
  );
}

/** Заголовок вложенного экрана: «‹ Сайт» над названием. */
export function SubHead({ back, backLabel, title, children }: { back: string; backLabel: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="px-[18px] pb-3 pt-4 lg:px-0 lg:pt-8">
      <Link href={back} className="-ml-1 inline-flex min-h-10 items-center gap-1 pr-2 text-[15px] font-semibold text-zinc-600 hover:text-ink">
        <CaretLeft size={18} weight="bold" /> {backLabel}
      </Link>
      <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
      {children && <div className="mt-1.5 text-[14px] leading-snug text-zinc-600">{children}</div>}
    </header>
  );
}

/** Группа строк на белой подложке: настройки, меню разделов. */
export function Group({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white ${className}`}>{children}</div>;
}

/** Строка меню: значок, название, текущее значение одной строкой и стрелка. */
export function MenuRow({ href, icon, title, value, tone }: { href: string; icon?: React.ReactNode; title: string; value?: React.ReactNode; tone?: "warn" }) {
  return (
    <Link href={href} className="flex min-h-16 items-center gap-3.5 px-4 py-3 hover:bg-zinc-50 active:bg-zinc-100">
      {icon && <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-paper text-ink">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold leading-tight">{title}</span>
        {value && <span className={`mt-0.5 block truncate text-[13.5px] ${tone === "warn" ? "font-semibold text-orange-700" : "text-zinc-500"}`}>{value}</span>}
      </span>
      <CaretRight size={18} className="shrink-0 text-zinc-400" />
    </Link>
  );
}

/** Кнопки выбора одного варианта вместо ввода чисел. Обычные radio: работает без JavaScript и с клавиатуры. */
export function Choice({ name, legend, hint, value, options }: { name: string; legend: string; hint?: string; value: string | number; options: { value: string | number; label: string }[] }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-[15px] font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input type="radio" name={name} value={o.value} defaultChecked={String(o.value) === String(value)} className="peer sr-only" />
            <span className="inline-flex min-h-11 items-center rounded-xl border border-zinc-300 bg-white px-4 text-[15px] font-medium peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2">
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {hint && <p className="text-[13px] leading-snug text-zinc-500">{hint}</p>}
    </fieldset>
  );
}
