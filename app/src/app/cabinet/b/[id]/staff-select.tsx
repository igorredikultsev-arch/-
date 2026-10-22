"use client";

import { useState, useTransition } from "react";
import { setBookingStaff } from "../../actions";

/** Кто делает запись: можно переставить к другому сотруднику, запись переедет в его колонку календаря. */
export function StaffSelect({ id, value, staff }: { id: string; value: string; staff: { id: string; name: string }[] }) {
  const [v, setV] = useState(value);
  const [pending, start] = useTransition();
  return (
    <select
      value={v}
      disabled={pending}
      aria-label="Пост"
      onChange={(e) => {
        const next = e.target.value;
        setV(next);
        start(async () => { await setBookingStaff(id, next || null); });
      }}
      className="-my-1 h-10 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2 text-[14px] font-medium disabled:opacity-60"
    >
      <option value="">Любой свободный</option>
      {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}
