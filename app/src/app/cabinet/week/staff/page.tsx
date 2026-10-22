import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { SubHead } from "../../ui";
import { StaffForm } from "./staff-form";

export default async function StaffPage() {
  const { business } = await requireOwner();
  const staff = await db.staff.findMany({
    where: { businessId: business.id },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, name: true, color: true, onStand: true },
  });
  return (
    <>
      <SubHead back="/cabinet/week" backLabel="Календарь" title="Сотрудники">
        Каждый сотрудник — колонка в календаре со своим цветом. Запись с сайта сама встаёт к свободному сотруднику.
      </SubHead>
      <div className="px-[18px] lg:max-w-2xl lg:px-0">
        <StaffForm initial={staff} posts={business.posts} standPosts={business.standPosts} />
      </div>
    </>
  );
}
