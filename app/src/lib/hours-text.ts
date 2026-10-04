import { hhmm } from "./time";

const WD = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** «Пн–Пт 9:00–20:00», «Сб 10:00–16:00», «Вс выходной» — подряд идущие одинаковые дни склеиваются. */
export function hoursLines(hours: { weekday: number; closed: boolean; openMin: number; closeMin: number }[]) {
  const byDay = (d: number) => {
    const h = hours.find((x) => x.weekday === d);
    return !h || h.closed ? "выходной" : `${hhmm(h.openMin).replace(/^0/, "")}–${hhmm(h.closeMin).replace(/^0/, "")}`;
  };
  const lines: string[] = [];
  let start = 1;
  for (let d = 2; d <= 8; d++) {
    if (d === 8 || byDay(d) !== byDay(start)) {
      const days = d - 1 === start ? WD[start] : `${WD[start]}–${WD[d - 1]}`;
      lines.push(`${days} ${byDay(start)}`);
      start = d;
    }
  }
  return lines;
}

