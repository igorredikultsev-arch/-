import { describe, expect, it } from "vitest";
import { passwordProblem } from "@/lib/auth";

describe("правила пароля владельца", () => {
  it("короткие, простые и с номером телефона не подходят", () => {
    expect(passwordProblem("abc12", "+79991234567")).toMatch(/8 символов/);
    expect(passwordProblem("12345678", "+79991234567")).toMatch(/простой/);
    expect(passwordProblem("aaaaaaaaaa", "+79991234567")).toMatch(/простой/);
    expect(passwordProblem("kolya1234567", "+79991234567")).toMatch(/номер/);
    expect(passwordProblem("Шины2026весна", "+79991234567")).toBeNull();
  });
});
