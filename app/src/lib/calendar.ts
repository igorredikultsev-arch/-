// Календарь кабинета: колонки (сотрудники или «Пост 1…N» и «Стенд») и раскладка записей. Чистые функции без базы.

/** «Свой период»: сколько дней можно выделить мышкой в мини-календаре. Здесь, а не в calendar.tsx: из клиентского модуля сервер получает не число, а ссылку. */
export const MAX_RANGE_DAYS = 14;

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

/** Записи, начавшиеся в пределах получаса, встают рядом; начавшаяся позже ложится внутрь идущей со сдвигом. */
const STACK_MS = 30 * 60000;
/** Сдвиг вложенной записи от левого края той, внутрь которой она легла (у Google ~24 px на колонку 490 px). */
const INDENT = 0.049;
/** Плашка, справа от которой в это время есть другая, шире своей доли: соседка перекрывает её часть. */
const WIDE = 1.7;
/** Длинные записи (от 2,5 часа) во вложенной группе стоят левее остальных. */
const LONG_MS = 2.5 * 3600000;

/**
 * Раскладка как в Google Календаре. Правило подобрано по скриншоту календаря клиента (17 записей за день,
 * расхождение с Google — доли процента ширины):
 * - записи дня, связанные пересечениями, делят колонку на столько долей, сколько колонок им нужно;
 * - начавшиеся почти одновременно (в пределах получаса) встают рядом, каждая плашка в 1,7 доли, если правее
 *   в это время что-то есть, иначе до правого края;
 * - начавшаяся позже идущих ложится внутрь той из них, что кончится позже всех (самая левая полоса не в счёт),
 *   со сдвигом вправо; такие записи делят оставшуюся справа ширину поровну, длинные левее;
 * - выше лежит та, что правее.
 * Ширину никто не задаёт — она получается из времени записей.
 */
export function googleLayout<T extends { id: string; start: number; end: number }>(items: T[]): Map<string, Placed> {
  type Node = { it: T; group: Group; slot: number; l: number; r: number };
  type Group = { parent: Node | null; members: Node[]; slots: Node[][]; l: number; r: number; cols: number };
  const overlap = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id));
  const out = new Map<string, Placed>();
  let i = 0;
  while (i < sorted.length) {
    // Связанные пересечениями записи раскладываются вместе
    const cluster = [sorted[i]];
    let end = sorted[i].end;
    for (i++; i < sorted.length && sorted[i].start < end; i++) { cluster.push(sorted[i]); end = Math.max(end, sorted[i].end); }
    const cols: T[][] = [];
    for (const it of cluster) { const c = cols.findIndex((c) => c.every((x) => !overlap(x, it))); if (c < 0) cols.push([it]); else cols[c].push(it); }

    const root: Group = { parent: null, members: [], slots: [], l: 0, r: 1, cols: cols.length };
    const groups: Group[] = [root];
    const nodes: Node[] = [];
    const long = (n: Node) => n.it.end - n.it.start >= LONG_MS;
    const arrange = (g: Group) => {
      // Во вложенной группе длинные левее, остальные по началу; колонку занимают только после стоящих в ней
      const order = g.parent
        ? [...g.members].sort((a, b) => +long(b) - +long(a) || (long(a) && long(b) ? (b.it.end - b.it.start) - (a.it.end - a.it.start) : 0) || a.it.start - b.it.start)
        : g.members;
      g.slots = [];
      for (const n of order) {
        let s = g.slots.findIndex((col) => col.every((m) => !overlap(m.it, n.it) && (!g.parent || m.it.end <= n.it.start)));
        if (s < 0) s = g.slots.length;
        n.slot = s;
        (g.slots[s] ??= []).push(n);
      }
    };
    const geometry = () => {
      for (const g of groups) {
        if (g.parent) { g.l = Math.min(g.parent.l + INDENT, 0.85); g.r = 1; }
        const step = (g.r - g.l) / Math.max(g.parent ? g.slots.length : Math.max(g.cols, g.slots.length), 1);
        g.slots.forEach((col, si) => col.forEach((n) => {
          n.l = g.l + si * step;
          const right = g.slots.some((t, j) => j > si && t.some((m) => overlap(m.it, n.it)));
          n.r = right ? Math.min(g.r, n.l + WIDE * step) : g.r;
        }));
      }
    };
    for (const it of cluster) {
      const active = nodes.filter((n) => overlap(n.it, it));
      const near = active.filter((n) => it.start - n.it.start < STACK_MS).sort((a, b) => b.it.start - a.it.start)[0];
      let group: Group;
      if (near || !active.length) group = near ? near.group : root;
      else {
        const byLeft = [...active].sort((a, b) => a.l - b.l);
        const pool = byLeft.length > 1 ? byLeft.slice(1) : byLeft;
        const parent = pool.sort((a, b) => b.it.end - a.it.end || b.l - a.l)[0];
        group = groups.find((g) => g.parent === parent) ?? { parent, members: [], slots: [], l: 0, r: 1, cols: 0 };
        if (!groups.includes(group)) groups.push(group);
      }
      const node: Node = { it, group, slot: 0, l: 0, r: 1 };
      group.members.push(node);
      nodes.push(node);
      arrange(group);
      geometry();
    }
    [...nodes].sort((a, b) => a.l - b.l || a.it.start - b.it.start).forEach((n, z) => out.set(n.it.id, { left: n.l, width: n.r - n.l, z: z + 1 }));
  }
  return out;
}
