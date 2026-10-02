"use client";

import { useState } from "react";
import type { AdminResult } from "./actions";

export const inp = "h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-[15px] outline-none focus:border-transparent focus:ring-2 focus:ring-accent";
export const btn = "inline-flex h-11 items-center justify-center rounded-xl bg-accent px-5 text-[15px] font-semibold text-white disabled:opacity-60";
export const btn2 = "inline-flex h-10 items-center justify-center rounded-xl bg-zinc-100 px-4 text-[14px] font-semibold disabled:opacity-60 hover:bg-zinc-200";

export function F({ label, id, hint, children, className = "" }: { label: string; id: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label htmlFor={id} className={`grid content-start gap-1 ${className}`}>
      <span className="text-[13px] font-semibold text-zinc-600">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Result({ state }: { state: AdminResult }) {
  if (state?.error) return <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-[14px] text-red-800">{state.error}</p>;
  if (state?.ok) return <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-[14px] text-emerald-900">{state.message}</p>;
  return null;
}

/** Кнопка «Скопировать»: в браузерах без доступа к буферу выделяет текст. */
export function CopyBox({ text, rows = 3, label }: { text: string; rows?: number; label: string }) {
  const [done, setDone] = useState(false);
  const id = `copy-${label.length}-${rows}`;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-zinc-600">{label}</label>
      <textarea id={id} readOnly value={text} rows={rows} className="w-full rounded-xl border border-zinc-300 bg-zinc-50 p-3 text-[14px] leading-snug" />
      <button
        type="button"
        className={btn2}
        onClick={async (e) => {
          try {
            await navigator.clipboard.writeText(text);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          } catch {
            const ta = (e.currentTarget.previousElementSibling as HTMLTextAreaElement);
            ta.select();
          }
        }}
      >
        {done ? "Скопировано" : "Скопировать"}
      </button>
    </div>
  );
}
