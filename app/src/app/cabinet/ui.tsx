// Общие элементы кабинета. Крупно и контрастно: владелец смотрит на ходу, иногда в перчатках.

export function PageHead({ kicker, title, children }: { kicker?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="px-[18px] pb-4 pt-6">
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
    <section className="grid gap-2 px-3.5 pt-5">
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
