"use client";

import { useActionState, useState } from "react";
import { addPayment, saveInfo, saveLead, startTrial } from "../../actions";
import { LEAD_LABEL, THEMES } from "../../labels";
import { btn, CopyBox, F, inp, Result } from "../../ui";

type Info = {
  name: string; city: string; address: string; phone: string; yandexMapsUrl: string; twoGisUrl: string; rating: string;
  reviewsYandex: string; reviews2gis: string; theme: string; accent: string; logoLetter: string; operatorName: string; operatorInn: string; customDomain: string;
};

export function InfoForm({ id, info }: { id: string; info: Info }) {
  const [state, action, pending] = useActionState(saveInfo.bind(null, id), null);
  const [accent, setAccent] = useState(info.accent);
  const field = (k: keyof Info, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <F label={label} id={`i-${k}`} hint={hint}><input id={`i-${k}`} name={k} defaultValue={info[k]} className={inp} {...extra} /></F>
  );
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Название", { required: true })}
        {field("phone", "Телефон", { required: true, type: "tel" })}
        {field("city", "Город", { required: true })}
        {field("address", "Адрес", { required: true })}
        {field("yandexMapsUrl", "Яндекс Карты", { type: "url" })}
        {field("twoGisUrl", "2ГИС", { type: "url" })}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {field("rating", "Рейтинг", { inputMode: "decimal" })}
        {field("reviewsYandex", "Отзывов Яндекс", { inputMode: "numeric" })}
        {field("reviews2gis", "Отзывов 2ГИС", { inputMode: "numeric" })}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <F label="Тема" id="i-theme">
          <select id="i-theme" name="theme" defaultValue={info.theme} className={inp}>
            {THEMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </F>
        <F label="Акцентный цвет" id="i-accent">
          <div className="flex gap-2">
            <input id="i-accent" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-11 w-14 rounded-lg border border-zinc-300" />
            <input name="accent" value={accent} onChange={(e) => setAccent(e.target.value)} className={inp} aria-label="Цвет" />
          </div>
        </F>
        {field("logoLetter", "Буква в логотипе", { maxLength: 2 }, "По умолчанию из названия")}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {field("operatorName", "Оператор ПДн", {}, "Как в реквизитах: ИП Шаров Д. А.")}
        {field("operatorInn", "ИНН оператора", { inputMode: "numeric" })}
        {field("customDomain", "Свой домен", {}, "Без https://. DNS: A-запись на сервер")}
      </div>
      <Result state={state} />
      <button disabled={pending} className={btn}>{pending ? "Сохраняем…" : "Сохранить"}</button>
    </form>
  );
}

export function LeadForm({ id, lead }: { id: string; lead: { status: string; channel: string; contact: string; notes: string } }) {
  const [state, action, pending] = useActionState(saveLead.bind(null, id), null);
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <F label="Этап" id="l-status">
          <select id="l-status" name="status" defaultValue={lead.status} className={inp}>
            {Object.entries(LEAD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </F>
        <F label="Канал" id="l-channel"><input id="l-channel" name="channel" defaultValue={lead.channel} className={inp} /></F>
        <F label="Контакт" id="l-contact"><input id="l-contact" name="contact" defaultValue={lead.contact} className={inp} /></F>
      </div>
      <F label="Заметки" id="l-notes"><textarea id="l-notes" name="notes" rows={3} defaultValue={lead.notes} className="w-full rounded-xl border border-zinc-300 p-3 text-[14px]" /></F>
      <Result state={state} />
      <button disabled={pending} className={btn}>Сохранить</button>
    </form>
  );
}

export function TrialForm({ id, loginUrl, siteUrl, hasOwner }: { id: string; loginUrl: string; siteUrl: string; hasOwner: boolean }) {
  const [state, action, pending] = useActionState(startTrial.bind(null, id), null);
  const [phone, setPhone] = useState("");
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="Телефон владельца" id="t-phone"><input id="t-phone" name="ownerPhone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} /></F>
        <F label="Имя владельца" id="t-name"><input id="t-name" name="ownerName" className={inp} /></F>
      </div>
      <Result state={state} />
      {state?.password && (
        <CopyBox
          label="Сообщение владельцу"
          rows={6}
          text={`Готово, ваш сайт работает: ${siteUrl}\n\nКабинет: ${loginUrl}\nТелефон: ${phone}\nПароль: ${state.password}\n\nПароль лучше сменить в разделе «Ещё». Первые 2 недели бесплатно.`}
        />
      )}
      <button disabled={pending} className={btn}>{hasOwner ? "Выдать новый пароль" : "Создать вход и начать пробный период"}</button>
    </form>
  );
}

export function PaymentForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(addPayment.bind(null, id), null);
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <F label="Сумма, ₽" id="p-amount"><input id="p-amount" name="amount" inputMode="numeric" required className={inp} placeholder="3500" /></F>
        <F label="За что" id="p-purpose" className="sm:col-span-2"><input id="p-purpose" name="purpose" className={inp} placeholder="Подключение и 1 месяц" /></F>
        <F label="Продлить на, мес" id="p-months" hint="0 — без продления"><input id="p-months" name="months" type="number" min={0} max={24} defaultValue={1} className={inp} /></F>
      </div>
      <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="receiptSent" className="size-4 accent-accent" /> Чек в «Мой налог» уже отправлен</label>
      <Result state={state} />
      <button disabled={pending} className={btn}>Записать оплату</button>
    </form>
  );
}
