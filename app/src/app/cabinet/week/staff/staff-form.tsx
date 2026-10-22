"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react";
import { GOOGLE_COLORS, STAFF_COLORS, type StaffRow } from "@/lib/calendar";
import { saveStaff, type ActionResult } from "../../actions";
import { Result, SaveBar } from "../../site/result";
import { btnSecondary, inputCls } from "../../ui";

type Row = Omit<StaffRow, "id"> & { id?: string; key: string };

let seq = 0;
const nextColor = (rows: Row[]) => STAFF_COLORS.find((c) => !rows.some((r) => r.color === c)) ?? STAFF_COLORS[rows.length % STAFF_COLORS.length];

export function StaffForm({ initial, posts, standPosts }: { initial: StaffRow[]; posts: number; standPosts: number }) {
  const [rows, setRows] = useState<Row[]>(() => initial.map((s) => ({ ...s, key: s.id })));
  const [picking, setPicking] = useState<string | null>(null);
  const [state, setState] = useState<ActionResult>(null);
  const [pending, start] = useTransition();

  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const move = (i: number, d: number) => setRows((rs) => { const a = [...rs]; [a[i], a[i + d]] = [a[i + d], a[i]]; return a; });
  const add = (onStand = false) => setRows((rs) => [...rs, { key: `new-${++seq}`, name: "", color: onStand ? "#616161" : nextColor(rs), onStand }]);
  // Для начала: по колонке на каждый пост и стенд, имена потом поменять на имена мастеров
  const byPosts = () =>
    setRows(() => {
      const out: Row[] = [];
      for (let i = 0; i < posts; i++) out.push({ key: `new-${++seq}`, name: `Пост ${i + 1}`, color: nextColor(out), onStand: false });
      for (let i = 0; i < standPosts; i++) out.push({ key: `new-${++seq}`, name: standPosts > 1 ? `Стенд ${i + 1}` : "Стенд развала", color: "#616161", onStand: true });
      return out;
    });

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setState(await saveStaff(rows.map(({ id, name, color, onStand }) => ({ id, name, color, onStand: standPosts > 0 && onStand })))));
      }}
    >
      {!rows.length && (
        <div className="grid gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-[14px] leading-snug text-zinc-600">
          Пока календарь показывает колонки «Пост 1…{posts}»{standPosts ? " и стенд" : ""}. Добавьте посты, чтобы выбирать их в записи.
          <button type="button" onClick={byPosts} className={btnSecondary}>Сделать колонку на каждый пост</button>
        </div>
      )}
      {rows.map((r, i) => (
        <div key={r.key} className="grid gap-2.5 rounded-2xl border border-zinc-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPicking(picking === r.key ? null : r.key)} aria-label="Цвет" aria-expanded={picking === r.key}
              className="grid size-12 shrink-0 place-items-center rounded-xl ring-1 ring-zinc-200">
              <i className="size-7 rounded-full" style={{ background: r.color }} />
            </button>
            <input value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} maxLength={30} placeholder="Например, Пост 1, Андрей"
              aria-label={`Пост ${i + 1}`} className={inputCls} />
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Выше" className="grid size-10 shrink-0 place-items-center rounded-lg text-zinc-500 disabled:opacity-25"><ArrowUp size={18} /></button>
            <button type="button" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Ниже" className="grid size-10 shrink-0 place-items-center rounded-lg text-zinc-500 disabled:opacity-25"><ArrowDown size={18} /></button>
            <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Удалить" className="grid size-10 shrink-0 place-items-center rounded-lg text-red-600"><Trash size={18} /></button>
          </div>
          {picking === r.key && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Цвет">
              {GOOGLE_COLORS.map(({ hex: c, name }) => (
                <button key={c} type="button" aria-pressed={r.color === c} aria-label={name} title={name} onClick={() => { patch(r.key, { color: c }); setPicking(null); }}
                  className={`size-9 rounded-full ${r.color === c ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: c }} />
              ))}
            </div>
          )}
          {standPosts > 0 && (
            <label className="flex items-center gap-2.5 text-[14px] text-zinc-700">
              <input type="checkbox" checked={r.onStand} onChange={(e) => patch(r.key, { onStand: e.target.checked })} className="size-5 accent-accent" />
              Стенд развала
            </label>
          )}
        </div>
      ))}
      <button type="button" onClick={() => add()} className={btnSecondary}><Plus size={18} weight="bold" /> Добавить пост</button>
      <p className="text-[12.5px] leading-snug text-zinc-500">
        Если удалить пост, его записи останутся и встанут на свободный пост.
      </p>
      <Result state={state} />
      <SaveBar pending={pending} label="Сохранить" />
    </form>
  );
}
