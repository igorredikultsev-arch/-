// Статистика владельца: что считается записью, сумма, неявки, отмены, столбики по дням и неделям.
import { describe, expect, it } from "vitest";
import { summarize } from "@/lib/stats";
import { localToUtc } from "@/lib/time";

const TZ = "Asia/Yekaterinburg";
const row = (date: string, source: "site" | "owner", status: "active" | "cancelled" | "no_show" | "done" = "done", serviceName = "Смена колёс", priceFrom: number | null = 1600) => ({
  startAt: new Date(localToUtc(date, 600, TZ)),
  source,
  status,
  serviceName,
  priceFrom,
});

describe("статистика", () => {
  it("отмены не считаются записями, неявки — без суммы", () => {
    const s = summarize(
      [row("2026-10-01", "site"), row("2026-10-01", "owner", "active", "Балансировка", 500), row("2026-10-02", "site", "no_show"), row("2026-10-03", "site", "cancelled")],
      "2026-09-28",
      "2026-10-04",
      TZ,
    );
    expect(s).toMatchObject({ total: 3, site: 2, owner: 1, revenue: 2100, noShow: 1, cancelled: 1 });
    expect(s.services).toEqual([{ name: "Смена колёс", count: 2 }, { name: "Балансировка", count: 1 }]);
    expect(s.buckets).toHaveLength(7);
    expect(s.buckets[3]).toMatchObject({ label: "1 окт", site: 1, owner: 1 });
  });
  it("за 90 дней — по неделям", () => {
    const s = summarize([row("2026-10-04", "site")], "2026-07-07", "2026-10-04", TZ);
    expect(s.buckets).toHaveLength(13);
    expect(s.buckets[0].label).toBe("7 июл – 13 июл");
    expect(s.buckets.at(-1)).toMatchObject({ label: "29 сен – 4 окт", site: 1 });
  });
});
