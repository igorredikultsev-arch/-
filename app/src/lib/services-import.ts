// Услуги из таблицы (файл, который присылает клиент): «Раздел на сайте | Название | Цена от | Минуты | Пояснение».
// Столбцы ищутся по заголовку; без заголовка — по порядку. Чистые функции.
// Таблица с группами (как у «Конкурента»): строка, где заполнен только раздел, — заголовок группы;
// разделы ниже становятся подразделами («Развал-схождение / Седан»), строка без названия, но с ценой или временем, — услуга
// с названием из столбца раздела. Цена «от 1000» — с «от», просто «1000» — точная (если в заголовке не «Цена от»).
import { SUB_SEP } from "@/lib/service-display";

export type ServiceRow = {
  category: string; name: string; priceFrom: number; priceExact: boolean; durationMin: number; description: string | null; onStand: boolean; isDiagnostic: boolean;
};
export type ServicesParse = { rows: ServiceRow[]; errors: string[] };

const COLS: Record<"category" | "name" | "priceFrom" | "durationMin" | "description", RegExp> = {
  category: /раздел|категор|группа/i,
  name: /назван|услуг/i,
  priceFrom: /цен|стоим|₽|руб/i,
  durationMin: /мин|время|длит/i,
  description: /поясн|описан|коммент|примеч/i,
};

/** «3 120 ₽», «от 500» → 3120, 500; пусто или «договорная» → 0 (на сайте: «после осмотра»). */
const money = (v: string) => { const d = v.replace(/[\s ]/g, "").match(/\d+/); return d ? Number(d[0]) : 0; };
/** «60», «1 ч», «1,5 ч», «1ч 30мин» → минуты; пусто — час. */
function minutes(v: string): number {
  const s = v.toLowerCase().replace(",", ".");
  if (!s.trim()) return 60;
  const h = s.match(/(\d+(?:\.\d+)?)\s*ч/), m = s.match(/(\d+)\s*м/);
  if (h || m) return Math.round((h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0));
  const n = Number(s.match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
  return Math.round(n);
}
/** Слово «от» в ячейке («от 1000», «Цена от»). Не через границу слова: в JS она не видит кириллицу */
const hasOt = (s: string) => /(^|[^а-яё])от([^а-яё]|$)/i.test(s);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Подраздел внутри группы: «Шиномонтаж седан» в группе «Шиномонтаж» → «Седан»; совпадает с группой — подраздела нет. */
function subOf(group: string, sub: string): string | null {
  if (!sub || sub.toLowerCase() === group.toLowerCase()) return null;
  const rest = sub.toLowerCase().startsWith(`${group.toLowerCase()} `) ? sub.slice(group.length).trim() : sub;
  return cap(rest);
}

export function parseServices(table: string[][]): ServicesParse {
  const rows: ServiceRow[] = [];
  const errors: string[] = [];
  const lines = table.map((r) => r.map((c) => String(c ?? "").trim())).filter((r) => r.some(Boolean));
  if (!lines.length) return { rows, errors: ["В таблице нет строк"] };
  // Заголовок: в строке нет числа там, где цена
  const head = lines[0];
  const hasHead = head.some((c) => COLS.name.test(c)) && !head.some((c) => /^\d[\d\s]*$/.test(c));
  const idx = { category: 0, name: 1, priceFrom: 2, durationMin: 3, description: 4 };
  if (hasHead) {
    for (const k of Object.keys(COLS) as (keyof typeof COLS)[]) {
      const i = head.findIndex((c) => COLS[k].test(c));
      if (i >= 0) idx[k] = i;
    }
    // «Название услуги» подходит и под раздел: раздел — другой столбец
    if (idx.category === idx.name) idx.category = head.findIndex((c, i) => i !== idx.name && COLS.category.test(c));
  }
  // «Цена от» в заголовке: все цены — «от», как было до точных цен
  const allFrom = hasHead && hasOt(head[idx.priceFrom] ?? "");
  const cell = (r: string[], k: keyof typeof idx) => (idx[k] >= 0 ? r[idx[k]] ?? "" : "");
  const body = hasHead ? lines.slice(1) : lines;
  // Строка-заголовок группы: заполнен только раздел
  const isGroup = (r: string[]) => !!cell(r, "category") && !cell(r, "name") && !cell(r, "priceFrom") && !cell(r, "durationMin") && !cell(r, "description");
  const grouped = body.some(isGroup);

  let lastCategory = "Услуги";
  let group: string | null = null;
  body.forEach((r, n) => {
    const line = n + (hasHead ? 2 : 1);
    if (grouped && isGroup(r)) { group = cap(cell(r, "category")); return; }
    let name = cell(r, "name");
    let category: string;
    if (grouped && group) {
      const sub = cell(r, "category");
      // Без названия, но с ценой, временем или пояснением: услуга называется по столбцу раздела («Балансировка», «Другой ремонт»)
      if (!name) { name = sub; category = group; }
      else { const s = subOf(group, sub); category = s ? `${group}${SUB_SEP}${s}` : group; }
    } else {
      if (!name) return;
      category = cap(cell(r, "category")) || lastCategory;
      lastCategory = category;
    }
    if (!name) return;
    const durationMin = minutes(cell(r, "durationMin"));
    if (durationMin < 10 || durationMin > 600) { errors.push(`Строка ${line}, «${name}»: время ${cell(r, "durationMin")} — нужно от 10 до 600 минут`); return; }
    if (name.length > 80) { errors.push(`Строка ${line}: название длиннее 80 знаков`); return; }
    const price = cell(r, "priceFrom");
    const text = `${category} ${name}`;
    rows.push({
      category: category.slice(0, 80),
      name,
      priceFrom: money(price),
      priceExact: !allFrom && money(price) > 0 && !hasOt(price),
      durationMin,
      description: cell(r, "description").slice(0, 300) || null,
      // Развал-схождение — на стенде (если стендов в правилах нет, отметка ни на что не влияет)
      onStand: /развал|сход/i.test(text),
      // Диагностика и осмотр: клиент пишет, что беспокоит
      isDiagnostic: /диагност|осмотр/i.test(text),
    });
  });
  if (rows.length > 100) return { rows: [], errors: ["Больше 100 услуг: оставьте в таблице только то, что будет на сайте"] };
  return { rows, errors };
}
