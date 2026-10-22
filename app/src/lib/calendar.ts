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
 * Раскладка как в Google Календаре (сверено со скриншотом календаря клиента):
 * - записи раскладываются по колонкам; освободившуюся колонку занимает следующая запись;
 * - k колонок делят ширину на k+1 долей: плашка шириной в две доли, соседка справа перекрывает её наполовину,
 *   поэтому левые выглядывают узкой полосой, а правая — широкая; справа свободно — плашка тянется до края;
 * - запись, которой нет свободной колонки и которая началась позже идущей, ложится поверх неё со сдвигом вправо;
 * - выше лежит та, что правее.
 * Ширину никто не задаёт — она получается из времени записей.
 */
export function googleLayout<T extends { id: string; start: number; end: number }>(items: T[]): Map<string, Placed> {
  type Node = { it: T; group: Group; slot: number; l: number; r: number };
  // first — начало первой записи группы, k0 — сколько колонок заняли записи, начавшиеся вместе с ней: эти колонки
  // делят ширину, и поздние записи ширину уже не меняют (как в Google: утренние плашки не сужаются из-за дневных)
  type Group = { parent: Node | null; slots: Node[][]; l: number; r: number; first: number; k0: number };
  const overlap = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id));
  const nodes: Node[] = [];
  const groups: Group[] = [];
  const freeSlot = (g: Group, it: T) => g.slots.findIndex((s) => s.every((n) => !overlap(n.it, it)));
  // Новая колонка в группе: для записей, начавшихся вместе с первой, — всегда; для поздних — одна узкая у правого края
  const canAdd = (g: Group, it: T) => it.start - g.first < STACK_MS || g.slots.length <= g.k0;
  for (const it of sorted) {
    const active = nodes.filter((n) => overlap(n.it, it));
    let group: Group | undefined;
    let slot = -1;
    if (active.length) {
      const near = active.filter((n) => it.start - n.it.start < STACK_MS).sort((a, b) => b.it.start - a.it.start)[0];
      if (near && (freeSlot(near.group, it) >= 0 || canAdd(near.group, it))) group = near.group;
      else {
        // Свободная колонка в одной из идущих сейчас групп (сначала во вложенных)
        group = [...groups].reverse().find((g) => (g.parent ? overlap(g.parent.it, it) : g.slots.flat().some((n) => overlap(n.it, it))) && freeSlot(g, it) >= 0);
        if (!group) {
          const parent = [...active].sort((a, b) => b.it.start - a.it.start || b.l - a.l)[0];
          const own = groups.find((g) => g.parent === parent);
          group = own && (freeSlot(own, it) >= 0 || canAdd(own, it)) ? own : { parent, slots: [], l: 0, r: 1, first: it.start, k0: 0 };
          if (!groups.includes(group)) groups.push(group);
        }
      }
      slot = freeSlot(group, it);
    }
    if (!group) { group = { parent: null, slots: [], l: 0, r: 1, first: it.start, k0: 0 }; groups.push(group); }
    if (slot < 0) slot = group.slots.length;
    if (it.start - group.first < STACK_MS) group.k0 = Math.max(group.k0, slot + 1);
    const node: Node = { it, group, slot, l: 0, r: 1 };
    (group.slots[slot] ??= []).push(node);
    nodes.push(node);
  }
  // Места: группа-родитель создана раньше вложенной, поэтому её места уже посчитаны
  for (const g of groups) {
    if (g.parent) { g.l = Math.min(g.parent.l + INDENT, 0.8); g.r = g.parent.group.r; }
    const step = (g.r - g.l) / (Math.max(g.k0, 1) + 1);
    g.slots.forEach((s, i) => s.forEach((n) => {
      n.l = g.l + i * step;
      const next = g.slots.findIndex((t, j) => j > i && t.some((m) => overlap(m.it, n.it)));
      n.r = next < 0 ? g.r : Math.min(g.r, g.l + (next + 1) * step);
    }));
  }
  const order = [...nodes].sort((a, b) => a.l - b.l || a.it.start - b.it.start);
  const out = new Map<string, Placed>();
  order.forEach((n, i) => out.set(n.it.id, { left: n.l, width: n.r - n.l, z: i + 1 }));
  return out;
}
