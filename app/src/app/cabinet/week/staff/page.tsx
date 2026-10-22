import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureStaff } from "@/lib/staff";
import { SubHead } from "../../ui";
import { ImportForm } from "./import-form";
import { StaffForm } from "./staff-form";

export default async function StaffPage() {
  const { business } = await requireOwner();
  await ensureStaff(business);
  const staff = await db.staff.findMany({
    where: { businessId: business.id },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, name: true, color: true, onStand: true },
  });
  return (
    <>
      <SubHead back="/cabinet/week" backLabel="Календарь" title="Посты и цвета">
        Цвет поста — цвет его записей в календаре. Название можно поменять, например «Пост 1, Андрей». Запись с сайта сама встаёт на свободный пост.
      </SubHead>
      <div className="px-[18px] lg:max-w-2xl lg:px-0">
        <StaffForm initial={staff} posts={business.posts} standPosts={business.standPosts} />
        <ImportForm />
      </div>
    </>
  );
}
