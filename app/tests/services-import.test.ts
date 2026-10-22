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
