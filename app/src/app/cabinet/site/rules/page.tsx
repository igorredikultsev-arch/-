import { requireOwner } from "@/lib/auth";
import { SubHead } from "../../ui";
import { RulesForm } from "../forms";

export default async function RulesPage() {
  const { business: b } = await requireOwner();
  return (
    <>
      <SubHead back="/cabinet/site" backLabel="Сайт" title="Правила записи">
        Как сайт предлагает клиентам свободное время.
      </SubHead>
      <div className="px-[18px] lg:max-w-2xl lg:px-0">
        <RulesForm r={{ posts: b.posts, cancelHours: b.cancelHours, horizonDays: b.horizonDays, minLeadMin: b.minLeadMin, slotStepMin: b.slotStepMin }} />
      </div>
    </>
  );
}
