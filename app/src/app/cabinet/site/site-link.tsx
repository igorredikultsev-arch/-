"use client";

import { useState } from "react";
import { ArrowSquareOut, Check, Copy } from "@phosphor-icons/react";
import { btnSecondary } from "../ui";

/** Адрес сайта с кнопками «Скопировать» и «Открыть». Без доступа к буферу выделяет адрес, чтобы скопировать вручную. */
export function SiteLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="grid gap-2">
      <input
        id="site-url"
        readOnly
        value={url}
        aria-label="Адрес сайта"
        onFocus={(e) => e.currentTarget.select()}
        className="h-12 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 text-[15px] font-semibold"
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={btnSecondary}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setDone(true);
              setTimeout(() => setDone(false), 1500);
            } catch {
              (document.getElementById("site-url") as HTMLInputElement | null)?.select();
            }
          }}
        >
          {done ? <Check size={18} /> : <Copy size={18} />} {done ? "Скопировано" : "Скопировать"}
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
          <ArrowSquareOut size={18} /> Открыть
        </a>
      </div>
    </div>
  );
}
