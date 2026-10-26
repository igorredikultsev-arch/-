// Услуги из таблицы клиента (22 октября): файл, который отправляли «Конкуренту», загружается в админке как есть.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseServices } from "@/lib/services-import";
import { readTable } from "@/lib/sheet";

describe("услуги из таблицы", () => {
  it("файл «Конкурента»: 22 услуги, разделы, цены, развал на стенде, осмотр с вопросом «что беспокоит»", () => {
    const [sheet] = readTable(readFileSync("tests/fixtures/konkurent-uslugi.xlsx"), "konkurent-uslugi.xlsx");
    const { rows, errors } = parseServices(sheet.rows);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(22);
    expect(rows[1]).toMatchObject({ category: "Шиномонтаж", name: "Шиномонтаж R16", priceFrom: 3600, durationMin: 60, onStand: false });
    expect(rows.find((r) => r.name === "Развал-схождение 2 оси")).toMatchObject({ onStand: true, priceFrom: 2500 });
    expect(rows.find((r) => r.name.startsWith("Другой ремонт"))).toMatchObject({ priceFrom: 0, isDiagnostic: true });
    expect(rows.find((r) => r.name === "Проверка развал-схождения")!.description).toBeNull();
  });

  it("без заголовка, время в часах, раздел из строки выше, плохое время — в пропущенные", () => {
    const { rows, errors } = parseServices([
      ["Шиномонтаж", "Шиномонтаж R14", "от 2 800 ₽", "1 ч"],
      ["", "Шиномонтаж R15", "3000", "1,5 ч"],
      ["Ремонт", "Капитальный ремонт", "50000", "3 дня"],
    ]);
    expect(rows.map((r) => [r.category, r.name, r.priceFrom, r.durationMin])).toEqual([
      ["Шиномонтаж", "Шиномонтаж R14", 2800, 60],
      ["Шиномонтаж", "Шиномонтаж R15", 3000, 90],
    ]);
    expect(errors).toHaveLength(1);
  });
});

describe("таблица с группами (как у «Конкурента», 26 октября)", () => {
  const { rows, errors } = parseServices([
    ["Шиномонтаж", "", "", "", ""],
    ["Шиномонтаж седан", "Шиномонтаж R16", "3600", "60", "4 колеса"],
    ["Шиномонтаж кроссоверы", "Шиномонтаж R18-R19", "5040", "60", ""],
    ["Балансировка", "", "", "60", "Цены уточняйте у администратора"],
    ["Техническое обслуживание", "", "", "", ""],
    ["Техническое обслуживание", "Замена масла и фильтра", "1000", "60", ""],
    ["Техническое обслуживание", "Замена свечей зажигания", "от 1000", "60", ""],
    ["Другой ремонт", "", "", "120", "Цены уточняйте у администратора"],
    ["Тормоза", "", "", "", ""],
    ["Колодки", "Замена передних колодок", "1200", "60", ""],
    ["колодки", "Замена задних колодок", "1500", "60", ""],
    ["Другие работы", "", "", "", ""],
    ["", "Консультация мастера", "", "60", ""],
  ]);
  it("группа — раздел, строки ниже — подразделы без повтора названия группы", () => {
    expect(errors).toEqual([]);
    expect(rows.map((r) => [r.category, r.name])).toEqual([
      ["Шиномонтаж / Седан", "Шиномонтаж R16"],
      ["Шиномонтаж / Кроссоверы", "Шиномонтаж R18-R19"],
      ["Шиномонтаж", "Балансировка"],
      ["Техническое обслуживание", "Замена масла и фильтра"],
      ["Техническое обслуживание", "Замена свечей зажигания"],
      ["Техническое обслуживание", "Другой ремонт"],
      ["Тормоза / Колодки", "Замена передних колодок"],
      ["Тормоза / Колодки", "Замена задних колодок"],
      ["Другие работы", "Консультация мастера"],
    ]);
  });
  it("число — цена точная, «от 1000» — с «от», пусто — после осмотра", () => {
    const by = (n: string) => rows.find((r) => r.name === n)!;
    expect(by("Замена масла и фильтра")).toMatchObject({ priceFrom: 1000, priceExact: true });
    expect(by("Замена свечей зажигания")).toMatchObject({ priceFrom: 1000, priceExact: false });
    expect(by("Балансировка")).toMatchObject({ priceFrom: 0, priceExact: false, durationMin: 60 });
  });
  it("с заголовком «Цена от» все цены по-прежнему «от»", () => {
    const r = parseServices([["Раздел", "Название", "Цена от", "Минуты"], ["ТО", "Замена масла", "1000", "60"]]).rows[0];
    expect(r.priceExact).toBe(false);
  });
});

describe("цена на сайте", () => {
  it("от, точная, после осмотра, бесплатно", async () => {
    const { priceText } = await import("@/lib/service-display");
    expect(priceText(1200)).toBe("от 1 200 ₽");
    expect(priceText(1200, true)).toBe("1 200 ₽");
    expect(priceText(0)).toBe("после осмотра");
    expect(priceText(0, true)).toBe("бесплатно");
  });
});
