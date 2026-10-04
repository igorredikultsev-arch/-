// Маска телефона в форме записи: привычка начинать с 8 или 7 не должна портить номер.
import { describe, expect, it } from "vitest";
import { maskPhone } from "@/app/s/[slug]/booking-widget";

// Набор по одной цифре, как на телефоне: к текущему значению поля дописывается символ
const type = (keys: string) => [...keys].reduce((v, k) => maskPhone(v + k), "+7");

describe("маска телефона", () => {
  it("с 8, с 7 и без кода — один и тот же номер", () => {
    expect(type("89121234567")).toBe("+7 (912) 123-45-67");
    expect(type("79121234567")).toBe("+7 (912) 123-45-67");
    expect(type("9121234567")).toBe("+7 (912) 123-45-67");
  });
  it("вставка целого номера", () => {
    expect(maskPhone("+7" + "+7 912 123-45-67")).toBe("+7 (912) 123-45-67");
    expect(maskPhone("+7" + "8 (912) 123 45 67")).toBe("+7 (912) 123-45-67");
    expect(maskPhone("+79121234567")).toBe("+7 (912) 123-45-67");
  });
  it("Backspace по скобке убирает цифру, а не застревает", () => {
    expect(type("912")).toBe("+7 (912");
    expect(maskPhone("+7 (91")).toBe("+7 (91");
    expect(maskPhone("")).toBe("+7");
  });
});
