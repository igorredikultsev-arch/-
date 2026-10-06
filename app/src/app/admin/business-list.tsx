"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { deleteBusinesses } from "./actions";
import { canBulkDelete, LEAD_LABEL, STATUS_CLS, STATUS_LABEL, THEMES } from "./labels";
import { btn2, Result } from "./ui";

export type ListRow = {
  id: string;
  name: string;
  city: string;
  address: string;
  status: keyof typeof STATUS_LABEL;
  theme: string;
  themeChosen: boolean;
  lead: keyof typeof LEAD_LABEL | null;
  channel: string | null;
  bookings: number;
};

const services = (n: number) => {
  const n10 = n % 10, n100 = n % 100;
  return `${n} ${n10 === 1 && n100 !== 11 ? "сервис" : n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14) ? "сервиса" : "сервисов"}`;
};

/** Список сервисов на главной админки. «Выбрать» включает галочки: отметить несколько демо и удалить разом. */
export function BusinessList({ rows }: { rows: ListRow[] }) {
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState(deleteBusinesses, null);
  const deletable = rows.filter((r) => canBulkDelete(r.status, r.lead));

  // После удаления — обычный список: удалённых в нём уже нет, а итог остаётся над ним
  useEffect(() => {
    if (state?.ok) {
      setPicked(new Set());
      setPicking(false);
    }
  }, [state]);

  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allPicked = deletable.length > 0 && deletable.every((r) => picked.has(r.id));

  const box = (r: ListRow) => {
    const can = canBulkDelete(r.status, r.lead);
    return (
      <input
        type="checkbox"
        checked={picked.has(r.id)}
        disabled={!can}
        onChange={() => toggle(r.id)}
        aria-label={can ? `Выбрать «${r.name}»` : `«${r.name}» нельзя удалить отсюда`}
        className="size-5 shrink-0 accent-red-600 disabled:opacity-30"
      />
    );
  };
  const why = (r: ListRow) => (canBulkDelete(r.status, r.lead) ? null : r.lead === "refused" ? "отказ: удалить можно в карточке" : "подключён: не удаляется");

  return (
    <>
      {deletable.length > 0 && !picking && (
        <button type="button" className={`${btn2} justify-self-start`} onClick={() => setPicking(true)}>Выбрать для удаления</button>
      )}
      <Result state={state} />

      {picking && (
        <form
          action={action}
          onSubmit={(e) => {
            if (!confirm(`Удалить ${services(picked.size)}? Демо-сайты, их записи и карточки лидов удалятся навсегда.`)) e.preventDefault();
          }}
          className="sticky top-[68px] z-[5] flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-200"
        >
          {[...picked].map((id) => <input key={id} type="hidden" name="id" value={id} />)}
          <span className="mr-auto text-[14px] font-semibold">Выбрано: {picked.size}</span>
          <button type="button" className={btn2} onClick={() => setPicked(allPicked ? new Set() : new Set(deletable.map((r) => r.id)))}>
            {allPicked ? "Снять все" : `Выбрать все демо (${deletable.length})`}
          </button>
          <button type="button" className={btn2} onClick={() => { setPicking(false); setPicked(new Set()); }}>Отмена</button>
          <button disabled={!picked.size || pending} className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-[14px] font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {pending ? "Удаляем…" : "Удалить"}
          </button>
        </form>
      )}

      {/* Телефон: карточки вместо широкой таблицы */}
      <ul className="grid gap-2 md:hidden">
        {rows.map((r) => {
          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <b className="text-[15.5px] leading-tight">{r.name}</b>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-[12px] font-semibold ${STATUS_CLS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
              </div>
              <span className="text-[13px] text-zinc-500">{r.city}, {r.address}</span>
              <span className="text-[13px] text-zinc-600">
                {r.lead ? LEAD_LABEL[r.lead] : ""}
                {r.bookings ? `, записей с сайта ${r.bookings}` : ""}
              </span>
              {picking && why(r) && <span className="text-[12.5px] text-zinc-400">{why(r)}</span>}
            </>
          );
          return (
            <li key={r.id}>
              {picking ? (
                <label className={`flex gap-3 rounded-2xl bg-white p-4 ring-1 ${picked.has(r.id) ? "ring-2 ring-red-500" : "ring-zinc-200"}`}>
                  <span className="pt-0.5">{box(r)}</span>
                  <span className="grid min-w-0 flex-1 gap-1.5">{body}</span>
                </label>
              ) : (
                <Link href={`/admin/b/${r.id}`} className="grid gap-1.5 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 active:bg-zinc-50">{body}</Link>
              )}
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc-200 md:block">
        <table className="w-full text-left text-[14px]">
          <thead className="text-[12.5px] text-zinc-500">
            <tr className="border-b border-zinc-100">
              {picking && <th className="w-10 py-2.5 pl-4"><span className="sr-only">Выбрать</span></th>}
              <th className="px-4 py-2.5 font-medium">Сервис</th>
              <th className="px-4 py-2.5 font-medium">Статус</th>
              <th className="px-4 py-2.5 font-medium">Этап</th>
              <th className="px-4 py-2.5 font-medium">С сайта</th>
              <th className="px-4 py-2.5 font-medium">Стиль</th>
              <th className="px-4 py-2.5 font-medium">Канал</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={picking && canBulkDelete(r.status, r.lead) ? (e) => { if (!(e.target as HTMLElement).closest("input,a")) toggle(r.id); } : undefined}
                className={`border-b border-zinc-50 last:border-0 ${picked.has(r.id) ? "bg-red-50" : "hover:bg-zinc-50"} ${picking && canBulkDelete(r.status, r.lead) ? "cursor-pointer" : ""}`}
              >
                {picking && <td className="py-3 pl-4">{box(r)}</td>}
                <td className="px-4 py-3">
                  <Link href={`/admin/b/${r.id}`} className="font-semibold hover:text-accent">{r.name}</Link>
                  <div className="text-[12.5px] text-zinc-500">{r.city}, {r.address}</div>
                  {picking && why(r) && <div className="text-[12px] text-zinc-400">{why(r)}</div>}
                </td>
                <td className="px-4 py-3"><span className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${STATUS_CLS[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                <td className="px-4 py-3">{r.lead ? LEAD_LABEL[r.lead] : ""}</td>
                <td className="px-4 py-3 tabular-nums">{r.bookings}</td>
                <td className="px-4 py-3">
                  {THEMES.find((t) => t.value === r.theme)?.label}
                  {r.themeChosen && <div className="text-[12px] font-semibold text-emerald-700">выбрал владелец</div>}
                </td>
                <td className="px-4 py-3 text-zinc-600">{r.channel || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
