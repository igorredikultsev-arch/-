// Услуги из таблицы (файл, который присылает клиент): «Раздел на сайте | Название | Цена от | Минуты | Пояснение».
// Столбцы ищутся по заголовку; без заголовка — по порядку. Чистые функции.

export type ServiceRow = { category: string; name: string; priceFrom: number; durationMin: number; description: string | null; onStand: boolean; isDiagnostic: boolean };
export type ServicesParse = { rows: ServiceRow[]; errors: string[] };

const COLS: Record<keyof Omit<ServiceRow, "onStand" | "isDiagnostic">, RegExp> = {
  category: /раздел|категор|группа/i,
  name: /назван|услуг/i,
  priceFrom: /цен|стоим|₽|руб/i,
  durationMin: /мин|время|длит/i,
  description: /поясн|описан|коммент|примеч/i,
};

/** «3 120 ₽», «от 500» → 3120, 500; пусто или «договорная» → 0 (на сайте: «после осмотра»). */
const money = (v: string) => { const d = v.replace(/[\s ]/g, "").match(/\d+/); return d ? Number(d[0]) : 0; };
/** «60», «1 ч», «1,5 ч», «1ч 30мин» → минуты; пусто — час. */
function minutes(v: string): number {
  const s = v.toLowerCase().replace(",", ".");
  if (!s.trim()) return 60;
  const h = s.match(/(\d+(?:\.\d+)?)\s*ч/), m = s.match(/(\d+)\s*м/);
  if (h || m) return Math.round((h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0));
  const n = Number(s.match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
  return Math.round(n);
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
  let lastCategory = "Услуги";
  (hasHead ? lines.slice(1) : lines).forEach((r, n) => {
    const line = n + (hasHead ? 2 : 1);
    const name = r[idx.name] ?? "";
    if (!name) return;
    const category = (idx.category >= 0 ? r[idx.category] : "") || lastCategory;
    lastCategory = category;
    const durationMin = minutes(r[idx.durationMin] ?? "");
    if (durationMin < 10 || durationMin > 600) { errors.push(`Строка ${line}, «${name}»: время ${r[idx.durationMin]} — нужно от 10 до 600 минут`); return; }
    if (name.length > 80) { errors.push(`Строка ${line}: название длиннее 80 знаков`); return; }
    const text = `${category} ${name}`;
    rows.push({
      category: category.slice(0, 40),
      name,
      priceFrom: money(r[idx.priceFrom] ?? ""),
      durationMin,
      description: (r[idx.description] ?? "").slice(0, 300) || null,
      // Развал-схождение — на стенде (если стендов в правилах нет, отметка ни на что не влияет)
      onStand: /развал|сход/i.test(text),
      // Диагностика и осмотр: клиент пишет, что беспокоит
      isDiagnostic: /диагност|осмотр/i.test(text),
    });
  });
  if (rows.length > 100) return { rows: [], errors: ["Больше 100 услуг: оставьте в таблице только то, что будет на сайте"] };
  return { rows, errors };
}
