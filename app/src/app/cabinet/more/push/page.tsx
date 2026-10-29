import { requireViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerDevices, vapidKeys } from "@/lib/push";
import { SubHead } from "../../ui";
import { DigestToggle } from "../digest-toggle";
import { PushToggle } from "../push-toggle";

export default async function PushPage() {
  const { user, business, asAdmin, readOnly } = await requireViewer();
  // Мастеру — его телефоны и записи только на его пост
  const devices = readOnly ? await db.pushSubscription.count({ where: { userId: user.id } }) : await ownerDevices(business.id);
  return (
    <>
      <SubHead back={readOnly ? "/cabinet/week" : "/cabinet/more"} backLabel={readOnly ? "Календарь" : "Ещё"} title="Уведомления о записях">
        {readOnly ? (
          <>Когда клиент записывается на сайте к вам на пост или отменяет такую запись, на телефон приходит уведомление: день, время и услуга. Остальное видно в календаре.</>
        ) : (
          <>
            Когда клиент записывается или отменяет запись на сайте, на телефон приходит уведомление: день, время и услуга. Имя и телефон клиента видны в кабинете.
            Утром приходит короткая сводка на день. Мастера с отдельным входом включают уведомления у себя и получают только записи на свой пост.
          </>
        )}
      </SubHead>
      <div className="grid gap-3 px-[18px] lg:max-w-2xl lg:px-0">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          {asAdmin ? (
            <p className="text-[14px] text-zinc-700">Уведомления включает сам владелец на своём телефоне. Устройств с уведомлениями: {devices}.</p>
          ) : (
            <PushToggle publicKey={(await vapidKeys()).publicKey} devices={devices} />
          )}
        </div>
        {!readOnly && (
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-1">
            <DigestToggle enabled={business.digestEnabled} />
          </div>
        )}
      </div>
    </>
  );
}
