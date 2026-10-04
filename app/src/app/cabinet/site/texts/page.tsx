import { requireOwner } from "@/lib/auth";
import { readFacts } from "@/lib/business";
import { SubHead } from "../../ui";
import { TextsForm } from "../forms";

export default async function TextsPage() {
  const { business: b } = await requireOwner();
  return (
    <>
      <SubHead back="/cabinet/site" backLabel="Сайт" title="Тексты на сайте" />
      <div className="px-[18px] lg:max-w-2xl lg:px-0">
        <TextsForm headline={b.headline ?? ""} addressNote={b.addressNote ?? ""} facts={readFacts(b.facts)} />
      </div>
    </>
  );
}
