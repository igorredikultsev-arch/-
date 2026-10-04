import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { hhmm } from "@/lib/time";
import { SubHead } from "../../ui";
import { HoursForm } from "../hours-form";

export default async function HoursPage() {
  const { business } = await requireOwner();
  const hours = await db.workingHours.findMany({ where: { businessId: business.id } });
  const rows = [1, 2, 3, 4, 5, 6, 7].map((wd) => {
    const h = hours.find((x) => x.weekday === wd);
    return {
      weekday: wd, closed: h ? h.closed : true, open: hhmm(h?.openMin ?? 540), close: hhmm(h?.closeMin ?? 1200),
      breakFrom: h?.breakFromMin != null ? hhmm(h.breakFromMin) : "", breakTo: h?.breakToMin != null ? hhmm(h.breakToMin) : "",
    };
  });
  return (
    <>
      <SubHead back="/cabinet/site" backLabel="Сайт" title="Часы работы" />
      <div className="px-[18px] lg:max-w-2xl lg:px-0">
        <HoursForm hours={rows} />
      </div>
    </>
  );
}
