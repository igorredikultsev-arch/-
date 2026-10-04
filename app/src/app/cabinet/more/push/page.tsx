import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { vapidKeys } from "@/lib/push";
import { SubHead } from "../../ui";
import { PushToggle } from "../push-toggle";

export default async function PushPage() {
  const { business, asAdmin } = await requireOwner();
  const devices = await db.pushSubscription.count({ where: { businessId: business.id } });
  return (
    <>
      <SubHead back="/cabinet/more" backLabel="Ещё" title="Уведомления о записях">
        Когда клиент записывается или отменяет запись на сайте, на телефон приходит уведомление: день, время и услуга. Имя и телефон клиента видны в кабинете.
      </SubHead>
      <div className="px-[18px] lg:max-w-2xl lg:px-0">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          {asAdmin ? (
            <p className="text-[14px] text-zinc-700">Уведомления включает сам владелец на своём телефоне. Устройств с уведомлениями: {devices}.</p>
          ) : (
            <PushToggle publicKey={(await vapidKeys()).publicKey} devices={devices} />
          )}
        </div>
      </div>
    </>
  );
}
