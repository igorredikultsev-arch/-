"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadSimple } from "@phosphor-icons/react";
import type { ImportResult } from "@/lib/calendar-import";
import { btnSecondary, Notice } from "../../ui";

/** Перенос записей из Google Календаря: архив из «Настройки → Импорт и экспорт → Экспорт». */
export function ImportForm() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const send = async () => {
    setPending(true); setError(null); setResult(null);
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    try {
      const r = await fetch("/cabinet/week/import", { method: "POST", body: form });
      const data = await r.json();
      if (!r.ok) setError(data.error ?? "Не получилось перенести");
      else { setResult(data); router.refresh(); }
    } catch {
      setError("Не получилось отправить файл. Проверьте интернет и попробуйте ещё раз");
    }
    setPending(false);
  };
  const total = result ? result.calendars.reduce((s, c) => s + c.bookings + c.notes, 0) : 0;
  return (
    <section id="import" className="mt-10 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-[18px] font-bold">Перенести записи из Google Календаря</h2>
      <ol className="list-decimal space-y-1 pl-5 text-[14px] leading-snug text-zinc-700">
        <li>Откройте Google Календарь на компьютере: calendar.google.com</li>
        <li>Шестерёнка справа вверху → «Настройки» → слева «Импорт и экспорт» → «Экспорт».</li>
        <li>Скачается архив .zip. Выберите его здесь.</li>
      </ol>
      <p className="text-[13px] leading-snug text-zinc-500">
        Каждый календарь Google станет постом с тем же названием: «Андронов» — к посту «Андронов», нет такого — появится новый.
        Переносятся записи с начала этой недели и дальше. Повторный перенос не создаёт копий.
      </p>
      <input type="file" accept=".zip,.ics" multiple aria-label="Архив из Google Календаря"
        onChange={(e) => { setFiles([...(e.target.files ?? [])]); setResult(null); setError(null); }}
        className="text-[14px] file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-200/70 file:px-3 file:py-2 file:font-semibold" />
      <button type="button" disabled={!files.length || pending} onClick={send} className={btnSecondary}>
        <DownloadSimple size={18} /> {pending ? "Переносим…" : "Перенести"}
      </button>
      {error && <Notice tone="error">{error}</Notice>}
      {result && (
        <Notice tone="ok">
          {total ? `Перенесено записей: ${total}.` : "Новых записей нет: всё уже перенесено или записи в прошлом."}
          {result.calendars.map((c) => <span key={c.name} className="block">{c.name} → {c.staff}: {c.bookings + c.notes}</span>)}
          {result.skippedRecurring > 0 && <span className="block">Повторяющиеся события не перенесены: {result.skippedRecurring}. Их нужно внести вручную.</span>}
          {result.skippedCalendars.length > 0 && <span className="block">Пропущены служебные календари: {result.skippedCalendars.join(", ")}.</span>}
        </Notice>
      )}
    </section>
  );
}
