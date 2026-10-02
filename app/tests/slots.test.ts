import { describe, expect, it } from "vitest";
import { daySlots, horizonDates, inHorizon, peakLoad, resolveDayWindow, type SlotInput } from "@/lib/slots";
import { addDays, localToUtc, toLocal, weekdayOf } from "@/lib/time";

const TZ = "Asia/Yekaterinburg"; // Пермь, UTC+5
const DATE = "2026-10-03"; // суббота
const at = (min: number, date = DATE) => localToUtc(date, min, TZ);
const h = (hh: number, mm = 0) => hh * 60 + mm;

function base(over: Partial<SlotInput> = {}): SlotInput {
  return {
    date: DATE,
    tz: TZ,
    window: { openMin: h(9), closeMin: h(20) },
    durationMin: 60,
    stepMin: 30,
    posts: 1,
    bookings: [],
    blocksAll: [],
    blocksOnePost: [],
    nowMs: at(0, "2026-10-01"),
    minLeadMin: 120,
    ...over,
  };
}
const free = (s: ReturnType<typeof daySlots>) => s.filter((x) => x.free).map((x) => x.time);
const all = (s: ReturnType<typeof daySlots>) => s.map((x) => x.time);

describe("time helpers", () => {
  it("переводит местное время Перми в UTC", () => {
    expect(new Date(at(h(10))).toISOString()).toBe("2026-10-03T05:00:00.000Z");
    expect(toLocal(at(h(10)), TZ)).toEqual({ date: DATE, minutes: h(10), weekday: 6 });
  });
  it("считает дни недели и сдвиг дат", () => {
    expect(weekdayOf("2026-10-04")).toBe(7);
    expect(weekdayOf("2026-10-05")).toBe(1);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("resolveDayWindow", () => {
  const hours = [
    { weekday: 6, closed: false, openMin: h(10), closeMin: h(16) },
    { weekday: 7, closed: true, openMin: 0, closeMin: 0 },
  ];
  it("берёт часы по дню недели", () => {
    expect(resolveDayWindow(DATE, hours, [])).toEqual({ openMin: h(10), closeMin: h(16) });
  });
  it("выходной — null", () => {
    expect(resolveDayWindow("2026-10-04", hours, [])).toBeNull();
  });
  it("день без строки часов — выходной", () => {
    expect(resolveDayWindow("2026-10-05", hours, [])).toBeNull();
  });
  it("праздник закрывает рабочий день", () => {
    expect(resolveDayWindow(DATE, hours, [{ date: DATE, closed: true, openMin: null, closeMin: null }])).toBeNull();
  });
  it("особый день меняет часы", () => {
    expect(resolveDayWindow(DATE, hours, [{ date: DATE, closed: false, openMin: h(12), closeMin: h(14) }])).toEqual({
      openMin: h(12),
      closeMin: h(14),
    });
  });
});

describe("daySlots", () => {
  it("последнее окно заканчивается ровно в закрытие", () => {
    const s = daySlots(base());
    expect(all(s)[0]).toBe("09:00");
    expect(all(s).at(-1)).toBe("19:00");
    expect(all(s)).not.toContain("19:30");
  });

  it("40-минутная услуга при шаге 30 не вылезает за закрытие", () => {
    const s = daySlots(base({ durationMin: 40 }));
    expect(all(s).at(-1)).toBe("19:00");
  });

  it("услуга длиннее рабочего дня — окон нет", () => {
    expect(daySlots(base({ durationMin: h(12) }))).toEqual([]);
  });

  it("выходной — окон нет", () => {
    expect(daySlots(base({ window: null }))).toEqual([]);
  });

  it("обед (закрыт весь сервис) убирает пересекающиеся окна", () => {
    const s = daySlots(base({ blocksAll: [{ start: at(h(13)), end: at(h(14)) }] }));
    const f = free(s);
    expect(f).toContain("12:00");
    expect(f).not.toContain("12:30"); // 12:30–13:30 задевает обед
    expect(f).not.toContain("13:00");
    expect(f).not.toContain("13:30");
    expect(f).toContain("14:00");
  });

  it("один пост: запись занимает окно и соседние пересечения", () => {
    const s = daySlots(base({ bookings: [{ start: at(h(10)), end: at(h(11)) }] }));
    const f = free(s);
    expect(f).toContain("09:00");
    expect(f).not.toContain("09:30");
    expect(f).not.toContain("10:00");
    expect(f).not.toContain("10:30");
    expect(f).toContain("11:00");
  });

  it("два поста: одна запись не занимает окно, две — занимают", () => {
    const one = daySlots(base({ posts: 2, bookings: [{ start: at(h(10)), end: at(h(11)) }] }));
    expect(free(one)).toContain("10:00");
    const two = daySlots(
      base({
        posts: 2,
        bookings: [
          { start: at(h(10)), end: at(h(11)) },
          { start: at(h(10)), end: at(h(11)) },
        ],
      }),
    );
    expect(free(two)).not.toContain("10:00");
    expect(free(two)).toContain("11:00");
  });

  it("два поста: записи, не пересекающиеся между собой, не блокируют окно", () => {
    // 10:00–10:40 и 10:40–11:20 никогда не идут одновременно → окно 10:00–11:00 свободно на 2-м посту
    const s = daySlots(
      base({
        posts: 2,
        bookings: [
          { start: at(h(10)), end: at(h(10, 40)) },
          { start: at(h(10, 40)), end: at(h(11, 20)) },
        ],
      }),
    );
    expect(free(s)).toContain("10:00");
  });

  it("два поста: пиковая занятость внутри окна, а не только в его начале", () => {
    // На 10:00 занят 1 пост, с 10:30 — оба. Окно 10:00–11:00 при 2 постах занято.
    const s = daySlots(
      base({
        posts: 2,
        bookings: [
          { start: at(h(9, 30)), end: at(h(11)) },
          { start: at(h(10, 30)), end: at(h(11, 30)) },
        ],
      }),
    );
    expect(free(s)).not.toContain("10:00");
  });

  it("закрытие одного поста уменьшает вместимость", () => {
    const s = daySlots(
      base({
        posts: 2,
        blocksOnePost: [{ start: at(h(9)), end: at(h(20)) }],
        bookings: [{ start: at(h(15)), end: at(h(16)) }],
      }),
    );
    expect(free(s)).toContain("09:00");
    expect(free(s)).not.toContain("15:00");
  });

  it("не показывает окна раньше «сейчас + 2 часа»", () => {
    const s = daySlots(base({ nowMs: at(h(10, 10)) }));
    expect(all(s)[0]).toBe("12:30");
  });

  it("переход через полночь по UTC: окно 04:30–05:30 по Перми пересекает 00:00 UTC", () => {
    const window = { openMin: h(4), closeMin: h(8) };
    // запись 05:00–05:30 по Перми = 00:00–00:30 UTC следующего (по UTC) дня
    const b = { start: at(h(5)), end: at(h(5, 30)) };
    expect(new Date(b.start).toISOString()).toBe("2026-10-03T00:00:00.000Z");
    const s = daySlots(base({ window, bookings: [b] }));
    expect(free(s)).not.toContain("04:30");
    expect(free(s)).toContain("04:00");
    expect(free(s)).toContain("05:30");
  });
});

describe("peakLoad", () => {
  it("считает максимум одновременно занятых постов", () => {
    const occ = [
      { start: 0, end: 10 },
      { start: 5, end: 15 },
      { start: 12, end: 20 },
    ];
    expect(peakLoad({ start: 0, end: 20 }, occ)).toBe(2);
    expect(peakLoad({ start: 10, end: 12 }, occ)).toBe(1);
    expect(peakLoad({ start: 20, end: 30 }, occ)).toBe(0);
  });
});

describe("горизонт записи", () => {
  const now = at(h(23, 30), "2026-10-03");
  it("сегодня по местному времени, а не по UTC", () => {
    expect(horizonDates(now, TZ, 3)).toEqual(["2026-10-03", "2026-10-04", "2026-10-05"]);
  });
  it("дата за горизонтом и в прошлом недоступна", () => {
    expect(inHorizon("2026-10-05", now, TZ, 3)).toBe(true);
    expect(inHorizon("2026-10-06", now, TZ, 3)).toBe(false);
    expect(inHorizon("2026-10-02", now, TZ, 3)).toBe(false);
  });
});

import { layoutLanes } from "@/lib/cabinet";

describe("layoutLanes", () => {
  it("раскладывает пересекающиеся записи по разным постам, а последовательные — на один", () => {
    const lanes = layoutLanes(2, { start: 0, end: 100 }, [
      { start: 0, end: 30, kind: "site" },
      { start: 10, end: 40, kind: "owner" },
      { start: 30, end: 50, kind: "site" },
    ]);
    expect(lanes[0].map((x) => x.startPct)).toEqual([0, 30]);
    expect(lanes[1].map((x) => x.startPct)).toEqual([10]);
  });
  it("перебор постов помечается как overflow", () => {
    const lanes = layoutLanes(1, { start: 0, end: 100 }, [
      { start: 0, end: 30, kind: "site" },
      { start: 10, end: 40, kind: "owner" },
    ]);
    expect(lanes[0][1].overflow).toBe(true);
  });
});
