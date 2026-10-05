"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { importDemos, type ImportRow } from "../actions";
import { btn, btn2, inp } from "../ui";
import { keepValues } from "@/lib/keep-form";

const STATUS: Record<ImportRow["status"], { label: string; cls: string }> = {
  created: { label: "Создано", cls: "bg-emerald-50 text-emerald-800" },
  exists: { label: "Уже было", cls: "bg-zinc-100 text-zinc-700" },
  skipped: { label: "Пропущено", cls: "bg-amber-50 text-amber-800" },
};

/** Таблица результата для Excel: точка с запятой и BOM, чтобы кириллица открылась без настройки. */
function downloadCsv(rows: ImportRow[]) {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Строка", "Название", "Итог", "Ссылка на демо", "Первый вопрос", "Сообщение с демо (после «да»)", "Канал связи", "Контакт", "Причина"];
  const body = rows.map((r) => [r.line, r.name, STATUS[r.status].label, r.url, r.question, r.message, r.channel, r.contact, r.reason].map(q).join(";"));
  const blob = new Blob(["﻿" + [head.map(q).join(";"), ...body].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `demo-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Copy({ text, label = "Скопировать сообщение" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={btn2}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          window.prompt("Скопируйте сообщение", text);
        }
      }}
    >
      {done ? "Скопировано" : label}
    </button>
  );
}

export function ImportForm() {
  const [state, action, pending] = useActionState(importDemos, null);
  const [tooBig, setTooBig] = useState(false);
  const rows = state?.rows ?? [];
  const n = (s: ImportRow["status"]) => rows.filter((r) => r.status === s).length;

  return (
    <div className="grid gap-5">
      <form onSubmit={keepValues(action)} className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
        <label className="grid gap-1">
          <span className="text-[13px] font-semibold text-zinc-600">Файл таблицы</span>
          <input
            name="file"
            type="file"
            required
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className={`${inp} h-auto py-2.5`}
            onChange={(e) => setTooBig((e.target.files?.[0]?.size ?? 0) > 900 * 1024)}
          />
        </label>
        {tooBig && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-[14px] text-red-800">Файл больше 900 КБ. Оставьте в нём только лист с сервисами.</p>}
        {state?.error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-[14px] text-red-800">{state.error}</p>}
        <button disabled={pending || tooBig} className={btn}>{pending ? "Создаём демо…" : "Создать демо"}</button>
      </form>

      {state?.rows && (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[17px] font-bold">
              Лист «{state.sheet}»: создано {n("created")}, уже было {n("exists")}, пропущено {n("skipped")}
            </h2>
            {rows.some((r) => r.url) && (
              <button type="button" className={`${btn2} ml-auto`} onClick={() => downloadCsv(rows)}>
                Скачать таблицу со ссылками
              </button>
            )}
          </div>
          <p className="text-[13px] text-zinc-500">Откройте демо и проверьте. Первым сообщением отправьте только вопрос, можно ли прислать пример, и поставьте этап «Спросили, ждём ответа». Сообщение с демо — в карточке сервиса, отправляйте его после ответа «да».</p>
          <ul className="grid gap-2">
            {rows.map((r) => (
              <li key={`${r.line}-${r.name}`} className="grid gap-2 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[13px] text-zinc-400">стр. {r.line}</span>
                  <b className="text-[15px]">{r.name}</b>
                  <span className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                  {r.reason && <span className="text-[13px] text-amber-800">{r.reason}</span>}
                  {r.contact && <span className="text-[13px] text-zinc-500">{[r.channel, r.contact].filter(Boolean).join(": ")}</span>}
                </div>
                {r.url && (
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="mr-auto break-all text-[14px] font-semibold text-accent">
                      {r.url.replace(/^https?:\/\//, "")}
                    </a>
                    {r.question && <Copy text={r.question} label="Скопировать вопрос" />}
                    <Link href={`/admin/b/${r.id}`} className={btn2}>Карточка</Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
