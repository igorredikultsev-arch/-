import { describe, expect, it } from "vitest";
import { z } from "zod";
import { firstIssue } from "@/lib/zod-ru";

describe("сообщения проверки по-русски", () => {
  it("число и длина — простыми словами, с названием поля", () => {
    const S = z.object({ priceFrom: z.coerce.number().max(1_000_000), name: z.string().max(5) });
    const r1 = S.safeParse({ priceFrom: "2000000", name: "ok" });
    expect(firstIssue(r1.error!, { priceFrom: "Цена" })).toMatch(/^Цена: слишком большое число: не больше 1\s000\s000$/);
    const r2 = S.safeParse({ priceFrom: "1", name: "длинное" });
    expect(firstIssue(r2.error!, { name: "Название" })).toBe("Название: слишком длинно: не больше 5 символов");
  });
});
