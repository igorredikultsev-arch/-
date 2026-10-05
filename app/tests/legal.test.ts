import { describe, expect, it } from "vitest";
import { consentText, offerText, ownPrivacyText, privacyText, type Processor } from "@/lib/legal";
import { rknDraft } from "@/lib/rkn";

// Документы не должны противоречить друг другу (юридическая проверка 5 октября): РКН сравнивает их между собой
const pr: Processor = { name: "Иванов Иван Иванович", inn: "590000000000", email: "igor@yandex.ru" };
const op = { name: "ИП Петров П. П.", inn: "590000000001", address: "г. Пермь, ул. Ленина, 1", phone: "+7 900 000-00-00" };
const flat = (s: { h?: string; p: string[] }[]) => s.map((x) => [x.h, ...x.p].join("\n")).join("\n");
const offer = flat(offerText(pr, { setup: "3 500 ₽", setupService: "2 510 ₽", monthly: "990 ₽", guaranteeDays: 14, graceDays: 7 }));
const consent = flat(consentText(op, "Ось", pr));
const privacy = flat(privacyText(op, "Ось", pr));
const own = flat(ownPrivacyText(pr));
const rkn = rknDraft({ name: "Ось", operatorName: op.name, operatorInn: op.inn, address: "ул. Ленина, 1", city: "Пермь", phone: "+79000000000" }, pr, "1 ноября 2026");

describe("документы", () => {
  it("после срока данные уничтожаются, а не обезличиваются, срок везде «с даты записи»", () => {
    for (const t of [offer, consent, privacy, rkn]) {
      expect(t).not.toMatch(/обезлич/i);
      expect(t).not.toMatch(/последней записи/);
    }
    for (const t of [offer, consent, privacy]) expect(t).toMatch(/3 года с даты записи/);
  });

  it("согласие перечисляет все данные из политики и оферты, включая IP-адрес и услугу", () => {
    expect(consent).toMatch(/дата, время и услуга записи; IP-адрес/);
    expect(offer).toMatch(/IP-адрес/);
    expect(privacy).toMatch(/IP-адрес/);
  });

  it("оферта: разовая услуга и абонентская плата, умысел, суд в Перми, реквизиты", () => {
    expect(offer).toMatch(/2 510 ₽/);
    expect(offer).toMatch(/ст\. 429\.4/);
    expect(offer).toMatch(/умышленному нарушению/);
    expect(offer).toMatch(/г\. Перми/);
    expect(offer).toMatch(/один раз для одного ИНН/);
    expect(offer).toMatch(/9\. Реквизиты Исполнителя/);
    expect(offer).toMatch(/Новая плата действует для месяцев доступа, оплаченных после даты изменения/);
  });

  it("политика Автослота: основание для предложений — согласие, удаление в 3 рабочих дня без «сразу», cookie, push", () => {
    expect(own).not.toMatch(/п\. 7 ч\. 1 ст\. 6/);
    expect(own).toMatch(/ст\. 15 152-ФЗ/);
    expect(own).not.toMatch(/удаляется сразу/);
    expect(own).toMatch(/Файлы cookie/);
    expect(own).toMatch(/трансграничная передача/i);
  });
});
