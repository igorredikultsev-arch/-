"use client";

import { useActionState, useState } from "react";
import { createDemo } from "../actions";
import { THEMES } from "../labels";
import { btn, F, inp, Result } from "../ui";

export function DemoForm() {
  const [state, action, pending] = useActionState(createDemo, null);
  const [theme, setTheme] = useState<string>("taxi");
  const [accent, setAccent] = useState<string>("#1f9d55");
  return (
    <form action={action} className="grid gap-5 rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Название, как на картах" id="d-name"><input id="d-name" name="name" required className={inp} placeholder="Шиномонтаж «Колесо»" /></F>
        <F label="Телефон из карточки" id="d-phone"><input id="d-phone" name="phone" type="tel" required className={inp} placeholder="+7 (342) 254-18-73" /></F>
        <F label="Город" id="d-city"><input id="d-city" name="city" defaultValue="Пермь" required className={inp} /></F>
        <F label="Адрес без города" id="d-addr"><input id="d-addr" name="address" required className={inp} placeholder="ул. Примерная, 12" /></F>
        <F label="Ссылка на Яндекс Карты" id="d-ya"><input id="d-ya" name="yandexMapsUrl" type="url" className={inp} placeholder="https://yandex.ru/maps/org/..." /></F>
        <F label="Ссылка на 2ГИС" id="d-2gis"><input id="d-2gis" name="twoGisUrl" type="url" className={inp} placeholder="https://2gis.ru/perm/firm/..." /></F>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <F label="Рейтинг" id="d-rating"><input id="d-rating" name="rating" inputMode="decimal" className={inp} placeholder="4.8" /></F>
          <F label="Отзывов в Яндексе" id="d-ry"><input id="d-ry" name="reviewsYandex" inputMode="numeric" className={inp} /></F>
          <F label="Отзывов в 2ГИС" id="d-r2"><input id="d-r2" name="reviews2gis" inputMode="numeric" className={inp} /></F>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <F label="Набор услуг" id="d-tpl">
          <select id="d-tpl" name="template" className={inp} defaultValue="tire">
            <option value="tire">Шиномонтаж</option>
            <option value="express">Экспресс-сервис</option>
          </select>
        </F>
        <F label="Тема" id="d-theme">
          <select id="d-theme" name="theme" className={inp} value={theme} onChange={(e) => { setTheme(e.target.value); setAccent(THEMES.find((t) => t.value === e.target.value)!.accent); }}>
            {THEMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </F>
        <F label="Акцент под логотип" id="d-accent">
          <div className="flex gap-2">
            <input id="d-accent" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-11 w-14 rounded-lg border border-zinc-300" />
            <input name="accent" value={accent} onChange={(e) => setAccent(e.target.value)} className={inp} aria-label="Цвет в формате #1f9d55" />
          </div>
        </F>
        <F label="Постов" id="d-posts"><input id="d-posts" name="posts" type="number" min={1} max={20} defaultValue={2} className={inp} /></F>
        <F label="Заголовок, необязательно" id="d-head" className="sm:col-span-2"><input id="d-head" name="headline" maxLength={70} className={inp} placeholder="Шиномонтаж без очереди. Запись за минуту" /></F>
        <F label="Канал связи" id="d-ch"><input id="d-ch" name="channel" className={inp} placeholder="Telegram, ВКонтакте, почта" /></F>
        <F label="Контакт" id="d-contact" className="sm:col-span-2"><input id="d-contact" name="contact" className={inp} placeholder="@koleso_perm или почта" /></F>
      </div>
      <Result state={state} />
      <button disabled={pending} className={btn}>{pending ? "Создаём…" : "Создать демо"}</button>
    </form>
  );
}
