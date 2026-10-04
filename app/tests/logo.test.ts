import { describe, expect, it } from "vitest";
import { imageMime, logoSrc } from "../src/lib/logo";
import { hoursLines } from "../src/lib/hours-text";

describe("логотип", () => {
  it("тип картинки определяется по первым байтам, SVG и прочее не принимаются", () => {
    expect(imageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(imageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(imageMime(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(imageMime(new TextEncoder().encode('<svg onload="alert(1)">'))).toBeNull();
    expect(imageMime(new Uint8Array([]))).toBeNull();
  });
  it("адрес логотипа меняется с каждой загрузкой, без логотипа — null", () => {
    expect(logoSrc("", new Date(5))).toBe("/logo?v=5");
    expect(logoSrc("/s/koleso", new Date(5))).toBe("/s/koleso/logo?v=5");
    expect(logoSrc("", null)).toBeNull();
  });
});

describe("часы работы одной строкой", () => {
  it("одинаковые дни подряд склеиваются", () => {
    const h = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, closed: false, openMin: 540, closeMin: 1200 }));
    expect(hoursLines([...h, { weekday: 6, closed: false, openMin: 600, closeMin: 1080 }, { weekday: 7, closed: true, openMin: 0, closeMin: 0 }])).toEqual([
      "Пн-Пт 9:00-20:00",
      "Сб 10:00-18:00",
      "Вс выходной",
    ]);
  });
});
