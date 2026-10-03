// Выбор по радиусу (тема «Боковина»): находим в названиях услуг диапазоны вроде «R13-R16» или «R20 и больше».
export type RadiusBand = { from: number; to: number; serviceId: string };

export function radiusBands(services: { id: string; name: string }[]): RadiusBand[] {
  const out: RadiusBand[] = [];
  for (const s of services) {
    const range = /R\s?(\d{2})\s*[-–]\s*R?\s?(\d{2})/i.exec(s.name);
    const open = /R\s?(\d{2})\s*(\+|и\s+больше|и\s+выше)/i.exec(s.name);
    const one = /R\s?(\d{2})\b/i.exec(s.name);
    let from: number, to: number;
    if (range) [from, to] = [+range[1], +range[2]];
    else if (open) [from, to] = [+open[1], Math.max(+open[1], 22)];
    else if (one) from = to = +one[1];
    else continue;
    if (from < 10 || to > 30 || to < from) continue;
    if (out.some((b) => from <= b.to && b.from <= to)) continue; // пересечения не берём: первая услуга главнее
    out.push({ from, to, serviceId: s.id });
  }
  return out.sort((a, b) => a.from - b.from);
}

/** Радиусы для кнопок: от меньшего к большему без пропусков. Пусто, если меньше двух диапазонов. */
export function radiusList(bands: RadiusBand[]): number[] {
  if (bands.length < 2) return [];
  const min = bands[0].from, max = bands[bands.length - 1].to;
  return Array.from({ length: max - min + 1 }, (_, i) => min + i).filter((r) => bands.some((b) => r >= b.from && r <= b.to));
}
