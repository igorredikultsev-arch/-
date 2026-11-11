// Календарь кабинета: колонки (сотрудники или «Пост 1…N» и «Стенд») и раскладка записей. Чистые функции без базы.

/**
 * «Свой период»: сколько дней можно выделить мышкой в мини-календаре (6 недель, как строк в месяце). До недели — колонки по часам,
 * больше — целые недели сеткой, как в Google. Здесь, а не в calendar.tsx: из клиентского модуля сервер получает не число, а ссылку.
 */
export const MAX_RANGE_DAYS = 42;
export const isMultiWeek = (view: string, days: number) => view === "custom" && days > 7;

/**
 * Цвета календарей Google с их названиями: у клиентов, которые переходят с Google Календаря, всё как было.
 * Первые — для «Пост 1…N» по порядку, графит — стенд.
 */
export const GOOGLE_COLORS = [
  { hex: "#7986cb", name: "Лаванда" },
  { hex: "#f4511e", name: "Мандарин" },
  { hex: "#0b8043", name: "Базилик" },
  { hex: "#ad1457", name: "Радикио" },
  { hex: "#039be5", name: "Павлин" },
  { hex: "#8e24aa", name: "Виноград" },
  { hex: "#e67c73", name: "Фламинго" },
  { hex: "#33b679", name: "Шалфей" },
  { hex: "#3f51b5", name: "Черника" },
  { hex: "#d50000", name: "Томатный" },
  { hex: "#ef6c00", name: "Тыква" },
  { hex: "#009688", name: "Эвкалипт" },
  { hex: "#f6bf26", name: "Банан" },
  { hex: "#c0ca33", name: "Авокадо" },
  { hex: "#795548", name: "Какао" },
  { hex: "#616161", name: "Графит" },
  // Остальные цвета Google (Сергей, 11 ноября: «светло-зелёный, серый»). В конце: у уже заведённых постов цвета не меняются
  { hex: "#7cb342", name: "Фисташковый" },
  { hex: "#a79b8e", name: "Берёза" },
  { hex: "#d81b60", name: "Вишнёвый цвет" },
  { hex: "#4285f4", name: "Кобальт" },
  { hex: "#9e69af", name: "Аметист" },
  { hex: "#e4c441", name: "Цитрон" },
  { hex: "#b39ddb", name: "Глициния" },
  { hex: "#f09300", name: "Манго" },
] as const;
export const STAFF_COLORS = GOOGLE_COLORS.map((c) => c.hex);
const STAND_COLOR = "#616161";

/** Цвет текста на плашке: белый, на светлых цветах (банан, авокадо) — тёмный, как в Google. */
export function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? "#202124" : "#ffffff";
}

export type Lane = { id: string; name: string; color: string; onStand: boolean; virtual: boolean };
export type StaffRow = { id: string; name: string; color: string; onStand: boolean };

/**
 * Колонки календаря. Есть сотрудники — они; нет — «Пост 1…N» и «Стенд развала» по настройкам записи,
 * чтобы календарь работал сразу, до того как владелец заведёт сотрудников.
 */
export function calendarLanes(staff: StaffRow[], posts: number, standPosts: number): Lane[] {
  if (staff.length) return staff.map((s) => ({ ...s, virtual: false }));
  const lanes: Lane[] = Array.from({ length: Math.max(posts, 1) }, (_, i) => ({
    id: `post-${i + 1}`, name: `Пост ${i + 1}`, color: STAFF_COLORS[i % STAFF_COLORS.length], onStand: false, virtual: true,
  }));
  for (let i = 0; i < standPosts; i++) {
    lanes.push({ id: `stand-${i + 1}`, name: standPosts > 1 ? `Стенд ${i + 1}` : "Стенд развала", color: STAND_COLOR, onStand: true, virtual: true });
  }
  return lanes;
}

export type CalItem = { id: string; start: number; end: number; staffId: string | null; onStand: boolean };

/**
 * К какой колонке относится запись. Своя колонка, если запись стоит к сотруднику; иначе — первая колонка
 * того же вида (пост или стенд), свободная в это время (так раскладываются записи до появления сотрудников).
 */
export function assignLanes<T extends CalItem>(items: T[], lanes: Lane[]): Map<string, string> {
  const out = new Map<string, string>();
  const busy = new Map<string, { start: number; end: number }[]>(lanes.map((l) => [l.id, []]));
  const known = new Set(lanes.map((l) => l.id));
  for (const it of items) {
    if (it.staffId && known.has(it.staffId)) {
      out.set(it.id, it.staffId);
      busy.get(it.staffId)!.push(it);
    }
  }
  const rest = items.filter((it) => !out.has(it.id)).sort((a, b) => a.start - b.start);
  for (const it of rest) {
    const kind = lanes.filter((l) => l.onStand === it.onStand);
    const pool = kind.length ? kind : lanes;
    const free = pool.find((l) => busy.get(l.id)!.every((b) => b.end <= it.start || b.start >= it.end)) ?? pool[0];
    if (!free) continue;
    out.set(it.id, free.id);
    busy.get(free.id)!.push(it);
  }
  return out;
}

/** Место записи в колонке дня: доли ширины колонки и порядок наложения (больше — выше). */
export type Placed = { left: number; width: number; z: number };

/**
 * Раскладка записей дня как в Google, но без лесенки: пересекающиеся записи встают рядом столбиками, у каждого поста свой
 * столбик по порядку постов (lane — номер поста), и записи одного поста идут в нём друг под другом. Две записи одного поста
 * в одно время — ещё столбик рядом. Справа свободно — плашка шире; справа соседка — левая заходит под неё краем,
 * своё начало с текстом всегда открыто.
 * Раньше раскладывали лесенкой, как Google при сдвинутом начале: в загруженный день записи закрывали друг друга (Сергей, 11 ноября).
 */
/** На сколько столбика плашка заходит под соседку справа (у Google плашка в 1,7 доли). */
const UNDER = 0.7;

export function columnLayout<T extends { id: string; start: number; end: number; lane: number }>(items: T[]): Map<string, Placed> {
  const overlap = (a: T, b: T) => a.start < b.end && b.start < a.end;
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id));
  const out = new Map<string, Placed>();
  for (let i = 0; i < sorted.length;) {
    // Связанные пересечениями записи делят ширину колонки вместе
    const group = [sorted[i]];
    let end = sorted[i].end;
    for (i++; i < sorted.length && sorted[i].start < end; i++) { group.push(sorted[i]); end = Math.max(end, sorted[i].end); }
    const cols: T[][] = [];
    for (const it of [...group].sort((a, b) => a.lane - b.lane || a.start - b.start)) {
      const c = cols.findIndex((col) => col[0].lane === it.lane && col.every((x) => !overlap(x, it)));
      if (c < 0) cols.push([it]); else cols[c].push(it);
    }
    cols.forEach((col, ci) => col.forEach((it) => {
      let span = 1;
      while (ci + span < cols.length && cols[ci + span].every((x) => !overlap(x, it))) span++;
      // Как в Google: если справа соседка, плашка заходит под неё на 0,7 столбика (соседка выше), начало с текстом открыто
      const width = ci + span < cols.length ? span + UNDER : span;
      out.set(it.id, { left: ci / cols.length, width: width / cols.length, z: ci + 1 });
    }));
  }
  return out;
}
