import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteService } from "../../../actions";
import { SubHead } from "../../../ui";
import { ServiceForm } from "../../forms";

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { business } = await requireOwner();
  const id = (await params).id;
  const service = id === "new" ? null : await db.service.findFirst({ where: { id, businessId: business.id } });
  if (id !== "new" && !service) notFound();
  const categories = (await db.service.findMany({ where: { businessId: business.id }, distinct: ["category"], select: { category: true } })).map((c) => c.category);
  return (
    <>
      <SubHead back="/cabinet/site/services" backLabel="Услуги" title={service ? service.name : "Новая услуга"} />
      <div className="grid gap-6 px-[18px] lg:max-w-2xl lg:px-0">
        <ServiceForm service={service} categories={categories.length ? categories : ["Шиномонтаж"]} />
        {service && (
          <form action={deleteService.bind(null, service.id)}>
            <button className="w-full py-2 text-[14px] font-semibold text-red-700 underline underline-offset-4">Удалить услугу</button>
            <p className="text-center text-[12px] text-zinc-500">Прошлые записи на неё сохранятся. Чтобы просто убрать с сайта, снимите галочку «Показывать на сайте».</p>
          </form>
        )}
      </div>
    </>
  );
}
