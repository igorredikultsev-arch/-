// Календарь кабинета: колонки (сотрудники или «Пост 1…N» и «Стенд») и раскладка записей. Чистые функции без базы.

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

/** Место записи в колонке дня: доли ширины колонки и порядок наложения (больше — выше). */
export type Placed = { left: number; width: number; z: number };

/** Записи, начавшиеся в пределах получаса, встают рядом; начавшаяся позже ложится поверх со сдвигом. */
const STACK_MS = 30 * 60000;
const INDENT = 0.05;

/**
 * Раскладка как в Google Календаре. Записи, которые начинаются почти одновременно, делят ширину и чуть
 * заходят друг под друга. Запись, которая начинается позже уже идущей, ложится поверх неё со сдвигом вправо
 * и тянется до правого края. Ширину никто не задаёт — она получается из времени записей.
 */
export function googleLayout<T extends { id: string; start: number; end: number }>(items: T[]): Map<string, Placed> {
  type Group = { l: number; r: number; parent: Node | null; members: Node[] };
  type Node = { it: T; group: Group; z: number; l: number; r: number };
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id));
  const nodes: Node[] = [];
  const groups: Group[] = [];
  for (const it of sorted) {
    const active = nodes.filter((n) => n.it.start < it.end && it.start < n.it.end);
    const near = active.filter((n) => it.start - n.it.start < STACK_MS).sort((a, b) => b.it.start - a.it.start)[0];
    let group: Group;
    if (near) group = near.group;
    else {
      const parent = active.sort((a, b) => b.it.start - a.it.start || b.l - a.l)[0] ?? null;
      group = { l: 0, r: 1, parent, members: [] };
      groups.push(group);
    }
    const node: Node = { it, group, z: nodes.length + 1, l: 0, r: 1 };
    group.members.push(node);
    nodes.push(node);
    // Места считаются заново по мере добавления: группа-родитель создана раньше вложенной
    for (const g of groups) {
      if (g.parent) {
        g.l = Math.min(g.parent.l + INDENT, 0.8);
        g.r = g.parent.group.r;
      }
      const slot = (g.r - g.l) / g.members.length;
      g.members.forEach((m, i) => { m.l = g.l + i * slot; m.r = m.l + slot; });
    }
  }
  const out = new Map<string, Placed>();
  for (const n of nodes) {
    const g = n.group;
    const last = g.members[g.members.length - 1] === n;
    // Как в Google: соседка справа перекрывает часть плашки, поэтому плашка шире своей доли
    const width = last ? n.r - n.l : Math.min(g.r - n.l, (n.r - n.l) * 1.7);
    out.set(n.it.id, { left: n.l, width, z: n.z });
  }
  return out;
}
