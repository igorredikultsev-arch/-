"use client";

import { useState, useTransition } from "react";
import { setDigest } from "../actions";

/** Переключатель утренней сводки: сохраняется сразу, без кнопки «Сохранить». */
export function DigestToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const toggle = (v: boolean) => {
    setOn(v);
    start(async () => {
      const r = await setDigest(v);
      if (!r?.ok) setOn(!v);
    });
  };
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3">
      <span className="grid gap-0.5">
        <b className="text-[15px]">Утренняя сводка в 8:00</b>
        <span className="text-[13px] leading-snug text-zinc-500">«Сегодня 6 записей, первая в 9:30». В дни без записей не приходит</span>
      </span>
      <input type="checkbox" checked={on} disabled={pending} onChange={(e) => toggle(e.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className="relative h-7 w-12 shrink-0 rounded-full bg-zinc-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2" />
    </label>
  );
}
