import { requireOwner } from "@/lib/auth";
import { SubHead } from "../../ui";
import { LogoForm } from "../logo-form";

export default async function LogoPage() {
  const { business: b } = await requireOwner();
  return (
    <>
      <SubHead back="/cabinet/site" backLabel="Сайт" title="Логотип" />
      <div className="px-[18px] lg:max-w-2xl lg:px-0">
        <LogoForm current={b.logoAt ? `/s/${b.slug}/logo?v=${b.logoAt.getTime()}` : null} name={b.name} headline={b.headline || "Запись онлайн без очереди"} />
      </div>
    </>
  );
}
