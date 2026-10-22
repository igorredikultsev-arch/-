// Календарь кабинета: колонки (сотрудники или «Пост 1…N» и «Стенд») и раскладка записей. Чистые функции без базы.

/** Цвета сотрудников: различимы между собой, белый текст читается на каждом. */
export const STAFF_COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#c026d3", "#4d7c0f", "#b45309", "#475569"] as const;

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
    lanes.push({ id: `stand-${i + 1}`, name: standPosts > 1 ? `Стенд ${i + 1}` : "Стенд развала", color: "#475569", onStand: true, virtual: true });
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

/**
 * Записи, которые пересекаются по времени, встают рядом, как в Google Календаре: у каждой номер столбика
 * внутри группы и число столбиков в группе.
 */
export function sideBySide<T extends { id: string; start: number; end: number }>(items: T[]): Map<string, { col: number; cols: number }> {
  const out = new Map<string, { col: number; cols: number }>();
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  let group: { it: T; col: number }[] = [];
  let groupEnd = -Infinity;
  const flush = () => {
    const cols = Math.max(0, ...group.map((g) => g.col)) + 1;
    for (const g of group) out.set(g.it.id, { col: g.col, cols });
    group = [];
  };
  for (const it of sorted) {
    if (group.length && it.start >= groupEnd) { flush(); groupEnd = -Infinity; }
    const colEnds: number[] = [];
    for (const g of group) colEnds[g.col] = Math.max(colEnds[g.col] ?? -Infinity, g.it.end);
    let col = colEnds.findIndex((e) => e <= it.start);
    if (col === -1) col = colEnds.length;
    group.push({ it, col });
    groupEnd = Math.max(groupEnd, it.end);
  }
  if (group.length) flush();
  return out;
}
