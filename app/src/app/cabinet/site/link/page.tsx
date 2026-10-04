import { SupportLink } from "../../support";
import QRCode from "qrcode";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { requireOwner } from "@/lib/auth";
import { publicSiteUrl } from "@/lib/site-url";
import { Group, SubHead } from "../../ui";
import { SiteLink } from "../site-link";

const steps = (items: string[]) => (
  <ol className="mt-3 grid list-decimal gap-2 pl-5 text-[14.5px] leading-snug text-zinc-700">
    {items.map((t) => <li key={t}>{t}</li>)}
  </ol>
);

export default async function LinkPage() {
  const { business } = await requireOwner();
  const url = publicSiteUrl(business.slug, business.customDomain, business.status);
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return (
    <>
      <SubHead back="/cabinet/site" backLabel="Сайт" title="Ссылка и QR-код">
        Чем больше мест, где клиенты видят ссылку, тем больше записей с сайта.
      </SubHead>
      <div className="grid gap-6 px-[18px] lg:grid-cols-2 lg:items-start lg:px-0">
        <section className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
          <SiteLink url={url} />
          <div className="flex items-center gap-4">
            {/* SVG собран на сервере библиотекой qrcode из адреса сайта */}
            <div role="img" aria-label="QR-код со ссылкой на сайт" className="size-32 shrink-0 rounded-xl border border-zinc-200 bg-white p-1.5" dangerouslySetInnerHTML={{ __html: qr }} />
            <div className="grid gap-2 text-[14px] leading-snug text-zinc-600">
              <p>Для таблички у ворот, визиток и кассы: клиент наводит камеру и сразу попадает на запись.</p>
              <a href="/cabinet/qr" className="inline-flex min-h-10 items-center gap-1.5 font-semibold text-accent">
                <DownloadSimple size={17} /> Скачать для печати
              </a>
            </div>
          </div>
        </section>
        <Group>
          <details className="group px-4 py-4">
            <summary className="cursor-pointer list-none text-[16px] font-semibold marker:hidden">Добавить в Яндекс Карты</summary>
            {steps([
              "Откройте Яндекс Бизнес (business.yandex.ru) под аккаунтом, к которому привязана карточка сервиса.",
              "Выберите свою организацию и откройте данные о ней: адрес, телефон, сайт.",
              "В поле «Сайт» вставьте ссылку и сохраните. Если можно настроить кнопку записи, укажите ту же ссылку.",
              "Изменения проверяет модерация Яндекса, обычно до нескольких дней.",
            ])}
          </details>
          <details className="group px-4 py-4">
            <summary className="cursor-pointer list-none text-[16px] font-semibold">Добавить в 2ГИС</summary>
            {steps([
              "Зайдите в личный кабинет 2ГИС для бизнеса, где управляете карточкой сервиса.",
              "В контактах организации добавьте сайт: вставьте ссылку и сохраните.",
              "Если кабинета нет, откройте свою карточку в 2ГИС и предложите исправление: укажите сайт.",
              "Изменения проверяет модерация 2ГИС.",
            ])}
          </details>
          <p className="px-4 py-4 text-[14px] leading-snug text-zinc-600">
            Ещё места для ссылки: группа ВКонтакте, канал в MAX или Telegram, автоответ в мессенджерах. Названия пунктов в Яндексе и 2ГИС иногда меняются:
            если не нашли, <SupportLink>напишите нам</SupportLink>, поможем.
          </p>
        </Group>
      </div>
    </>
  );
}
