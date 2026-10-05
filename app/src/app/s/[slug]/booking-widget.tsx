"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDayLong, formatDayShort } from "@/lib/time";
import { PICK_EVENT, SLOT_EVENT, STATE_EVENT, type SlotPick } from "./events";

export type WidgetService = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  priceFrom: number;
  durationMin: number;
  isDiagnostic: boolean;
};

type Day = { date: string; closed: boolean; free: number };
type SlotRow = { time: string; free: boolean };
type Props = {
  services: WidgetService[];
  apiBase: string;
  siteBase: string;
  consentHref: string;
  privacyHref: string;
  captchaKey: string;
  timezone: string;
  phone: string; // для звонка, когда свободного времени нет
  phoneLabel: string;
  demo: boolean;
};

declare global {
  interface Window {
    smartCaptcha?: { render: (el: HTMLElement, opts: { sitekey: string; hl?: string; callback?: (t: string) => void }) => number; reset: (id?: number) => void };
  }
}

const freeWord = (n: number) =>
  n % 10 === 1 && n % 100 !== 11 ? "свободное окно" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "свободных окна" : "свободных окон";

/**
 * +7 (342) 254-18-73 по мере ввода. Поле уже начинается с «+7», поэтому эти символы отрезаются как текст, а не как цифра.
 * Многие по привычке начинают с 8 или 7: ведущая 8 — всегда код страны (номеров с кодом 8xx у водителей нет),
 * ведущая 7 — только когда набрано 11 цифр.
 */
export function maskPhone(v: string) {
  const raw = v.startsWith("+7") ? v.slice(2) : v;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("8") || (d.length === 11 && d.startsWith("7"))) d = d.slice(1);
  d = d.slice(0, 10);
  let out = "+7";
  if (d.length) out += ` (${d.slice(0, 3)}`;
  // Скобка — только когда пошли следующие цифры, иначе Backspace по ней сразу возвращает её обратно
  if (d.length > 3) out += `) ${d.slice(3, 6)}`;
  if (d.length > 6) out += `-${d.slice(6, 8)}`;
  if (d.length > 8) out += `-${d.slice(8, 10)}`;
  return out;
}

const dur = (m: number) => (m < 60 ? `${m} мин` : m % 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m / 60} ч`);

export function BookingWidget(p: Props) {
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [days, setDays] = useState<Day[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotRow[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+7");
  const [car, setCar] = useState("");
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  // Не загрузилось (нет сети, сервер не ответил): вместо вечной загрузки — сообщение и кнопка «Повторить»
  const [loadFailed, setLoadFailed] = useState(false);
  // Номер последнего запроса: ответ на старый запрос (клиент успел выбрать другой день) не должен затереть новый
  const seq = useRef(0);
  const hpRef = useRef<HTMLInputElement>(null);
  const captchaRef = useRef<HTMLDivElement>(null);
  const captchaId = useRef<number | null>(null);

  const service = p.services.find((s) => s.id === serviceId) ?? null;

  const getJson = useCallback(
    async (path: string) => {
      const r = await fetch(`${p.apiBase}${path}`);
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    [p.apiBase],
  );

  const loadSlots = useCallback(
    async (sid: string, d: string) => {
      const id = ++seq.current;
      setSlots(null);
      setLoadFailed(false);
      try {
        const data = await getJson(`/slots?service=${sid}&date=${d}`);
        if (id === seq.current) setSlots(data.slots);
      } catch {
        if (id === seq.current) setLoadFailed(true);
      }
    },
    [getJson],
  );

  const chooseService = useCallback(
    async (sid: string) => {
      const id = ++seq.current;
      setServiceId(sid);
      setTime(null);
      setStep(2);
      setDays(null);
      setSlots(null);
      setLoadFailed(false);
      let list: Day[];
      try {
        list = (await getJson(`/days?service=${sid}`)).days;
      } catch {
        if (id === seq.current) setLoadFailed(true);
        return;
      }
      if (id !== seq.current) return;
      setDays(list);
      const first = list.find((x) => x.free > 0) ?? list.find((x) => !x.closed);
      if (first) {
        setDate(first.date);
        loadSlots(sid, first.date);
      } else setSlots([]);
    },
    [getJson, loadSlots],
  );

  const retry = () => {
    if (!serviceId) return;
    if (days === null) chooseService(serviceId);
    else if (date) loadSlots(serviceId, date);
  };

  useEffect(() => {
    const on = (e: Event) => chooseService((e as CustomEvent<string>).detail);
    window.addEventListener(PICK_EVENT, on);
    return () => window.removeEventListener(PICK_EVENT, on);
  }, [chooseService]);

  // Время выбрано на плане постов или на шкале дня: сразу к контактам
  useEffect(() => {
    const on = async (e: Event) => {
      const { serviceId: sid, date: d, time: t } = (e as CustomEvent<SlotPick>).detail;
      setServiceId(sid);
      setDate(d);
      setTime(t);
      setNotice(null);
      setStep(3);
      loadSlots(sid, d);
      // Список дней нужен только для возврата к выбору времени: не загрузился — покажется «Повторить» на шаге времени
      setDays(await getJson(`/days?service=${sid}`).then((x) => x.days as Day[]).catch(() => (setLoadFailed(true), null)));
    };
    window.addEventListener(SLOT_EVENT, on);
    return () => window.removeEventListener(SLOT_EVENT, on);
  }, [getJson, loadSlots]);

  // Сообщаем витрине (план, шкала), какая услуга и время выбраны
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: { serviceId, date, time } }));
  }, [serviceId, date, time]);

  // Яндекс SmartCaptcha на шаге контактов. Форма контактов пропадает при возврате к выбору времени,
  // вместе с ней пропадает и капча: при следующем показе её нужно нарисовать заново
  useEffect(() => {
    if (step !== 3) {
      captchaId.current = null;
      setCaptcha("");
      return;
    }
    if (!p.captchaKey || !captchaRef.current) return;
    const render = () => {
      if (window.smartCaptcha && captchaRef.current && captchaId.current == null) {
        captchaId.current = window.smartCaptcha.render(captchaRef.current, { sitekey: p.captchaKey, hl: "ru", callback: setCaptcha });
      }
    };
    if (window.smartCaptcha) return render();
    const s = document.createElement("script");
    s.src = "https://smartcaptcha.yandexcloud.net/captcha.js";
    s.defer = true;
    s.onload = render;
    s.onerror = () => setNotice(`Не загрузилась проверка «я не робот». Обновите страницу или позвоните: ${p.phoneLabel}`);
    document.head.appendChild(s);
  }, [step, p.captchaKey, p.phoneLabel]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !date || !time) return;
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Укажите имя";
    if (phone.replace(/\D/g, "").length !== 11) errs.phone = "Нужен номер из 10 цифр после +7";
    if (car.trim().length < 2) errs.car = "Укажите марку и модель";
    if (service.isDiagnostic && comment.trim().length < 5) errs.comment = "Опишите, что беспокоит в машине";
    if (!consent) errs.consent = "Без согласия на обработку данных записаться нельзя";
    if (p.captchaKey && !captcha) errs.captcha = "Подтвердите, что вы не робот";
    setFieldErr(errs);
    if (Object.keys(errs).length) return;

    setSending(true);
    setNotice(null);
    try {
      const r = await fetch(`${p.apiBase}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id, date, time, name, phone, car, comment, consent, captcha,
          website: hpRef.current?.value || "",
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 201) {
        window.location.href = `${p.siteBase}/b/${data.token}`;
        return;
      }
      // Время заняли или оно уже прошло, пока клиент заполнял форму: обратно к выбору со свежим списком
      if (data.code === "slot_taken" || data.code === "bad_slot") {
        setStep(2);
        setTime(null);
        setNotice(data.error);
        loadSlots(service.id, date);
        return;
      }
      if (data.fields) setFieldErr(data.fields);
      setNotice(data.error || "Не удалось записаться. Попробуйте ещё раз или позвоните в сервис");
      if (captchaId.current != null) {
        window.smartCaptcha?.reset(captchaId.current);
        setCaptcha("");
      }
    } catch {
      setNotice("Нет связи. Проверьте интернет и попробуйте ещё раз");
    } finally {
      setSending(false);
    }
  }

  const freeCount = slots?.filter((s) => s.free).length ?? 0;
  const dayShort = date ? formatDayShort(date) : null;
  // Во всём горизонте записи нет ни одного свободного окна (всё занято или выходные)
  const noneAtAll = days !== null && days.length > 0 && days.every((d) => d.free === 0);
  // Ошибка поля пропадает, как только клиент его исправляет
  const clearErr = (k: string) => fieldErr[k] && setFieldErr(({ [k]: _, ...rest }) => rest);

  return (
    <section className="book" id="book" aria-labelledby="book-title">
      <h2 className="h4" id="book-title">
        Запись
      </h2>
      <div className="steps" aria-hidden="true">
        <div className={step > 1 ? "is-done" : "is-cur"}>Услуга</div>
        <div className={step === 2 ? "is-cur" : step > 2 ? "is-done" : ""}>Время</div>
        <div className={step === 3 ? "is-cur" : ""}>Контакты</div>
      </div>

      {notice && (
        <p className="form-err" role="alert">
          {notice}
        </p>
      )}

      {step === 1 && (
        <div className="svc-pick" role="group" aria-label="Выберите услугу">
          {p.services.map((s) => (
            <button key={s.id} type="button" aria-pressed={s.id === serviceId} onClick={() => chooseService(s.id)}>
              <span className="n">{s.name}</span>
              <span className="m">{s.category}</span>
              <span className="p">{s.priceFrom > 0 ? `от ${s.priceFrom.toLocaleString("ru-RU")} ₽` : "бесплатно"}</span>
            </button>
          ))}
        </div>
      )}

      {step >= 2 && service && (
        <div className="picked">
          <span>
            {service.name}, {dur(service.durationMin)}
          </span>
          <button type="button" onClick={() => { setStep(1); setNotice(null); }}>
            Изменить
          </button>
        </div>
      )}

      {step === 2 && service && (
        <>
          {loadFailed && (
            <div className="slots-empty" role="alert">
              Не получилось загрузить свободное время. Проверьте интернет.{" "}
              <button type="button" className="link-btn" onClick={retry}>Повторить</button>
            </div>
          )}
          <div className="days" role="group" aria-label="День">
            {days === null && !loadFailed && <div className="skeleton" style={{ height: 62, width: "100%" }} />}
            {days?.map((d, i) => {
              const f = formatDayShort(d.date);
              return (
                <button
                  key={d.date}
                  type="button"
                  className="day"
                  disabled={d.closed}
                  aria-pressed={d.date === date}
                  aria-label={`${formatDayLong(d.date)}${d.closed ? ", выходной" : `, ${d.free} ${freeWord(d.free)}`}`}
                  onClick={() => { setDate(d.date); setTime(null); loadSlots(service.id, d.date); }}
                >
                  <small>{f.weekday}</small>
                  <b>{f.day}</b>
                  <em>{d.closed ? "выходной" : d.free === 0 ? "занято" : i === 0 ? "сегодня" : ""}</em>
                </button>
              );
            })}
          </div>
          {date && (
            <div className="slot-head">
              <b>{formatDayLong(date)}</b>
              <span>{slots ? `${freeCount} ${freeWord(freeCount)}` : ""}</span>
            </div>
          )}
          <div className="slots" role="group" aria-label="Время">
            {slots === null && !loadFailed && <div className="skeleton" />}
            {noneAtAll && slots !== null && (
              <div className="slots-empty">
                В ближайшие {days!.length} дней свободного времени нет. Позвоните, договоримся: <a href={`tel:${p.phone}`}>{p.phoneLabel}</a>
              </div>
            )}
            {!noneAtAll && slots?.length === 0 && <div className="slots-empty">В этот день записаться нельзя. Выберите другой.</div>}
            {!noneAtAll && slots && slots.length > 0 && freeCount === 0 && <div className="slots-empty">Всё занято. Выберите другой день.</div>}
            {slots?.map((s) => (
              <button
                key={s.time}
                type="button"
                className="slot"
                disabled={!s.free}
                aria-pressed={s.time === time}
                aria-label={s.free ? s.time : `${s.time}, занято`}
                onClick={() => setTime(s.time)}
              >
                {s.time}
              </button>
            ))}
          </div>
          <button className="btn wide" type="button" disabled={!time} onClick={() => { setStep(3); setNotice(null); }}>
            {time && dayShort ? `Дальше: ${dayShort.weekday} ${dayShort.day} ${dayShort.month}, ${time}` : "Выберите время"}
          </button>
          <div className="hint">Дальше имя, телефон и марка машины</div>
        </>
      )}

      {step === 3 && service && date && time && (
        <form onSubmit={submit} noValidate>
          <div className="picked">
            <span>
              {formatDayLong(date)}, {time}
            </span>
            <button type="button" onClick={() => setStep(2)}>
              Изменить
            </button>
          </div>
          <div className="field">
            <label htmlFor="bk-name">Имя</label>
            <input id="bk-name" autoComplete="given-name" value={name} onChange={(e) => { setName(e.target.value); clearErr("name"); }} maxLength={60} aria-invalid={!!fieldErr.name} />
            {fieldErr.name && <span className="err">{fieldErr.name}</span>}
          </div>
          <div className="field">
            <label htmlFor="bk-phone">Телефон</label>
            <input id="bk-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(maskPhone(e.target.value)); clearErr("phone"); }} aria-invalid={!!fieldErr.phone} />
            {fieldErr.phone && <span className="err">{fieldErr.phone}</span>}
          </div>
          <div className="field">
            <label htmlFor="bk-car">Марка и модель машины</label>
            <input id="bk-car" placeholder="Например, Kia Rio" value={car} onChange={(e) => { setCar(e.target.value); clearErr("car"); }} maxLength={60} aria-invalid={!!fieldErr.car} />
            {fieldErr.car && <span className="err">{fieldErr.car}</span>}
          </div>
          <div className="field">
            <label htmlFor="bk-comment">{service.isDiagnostic ? "Что беспокоит в машине" : "Комментарий, если нужно"}</label>
            <textarea
              id="bk-comment"
              value={comment}
              onChange={(e) => { setComment(e.target.value); clearErr("comment"); }}
              maxLength={500}
              placeholder={service.isDiagnostic ? "Например, стучит спереди справа на кочках" : ""}
              aria-invalid={!!fieldErr.comment}
            />
            {fieldErr.comment && <span className="err">{fieldErr.comment}</span>}
          </div>
          <input ref={hpRef} className="hp" tabIndex={-1} autoComplete="off" name="website" aria-hidden="true" />
          <label className="consent" htmlFor="bk-consent">
            <input id="bk-consent" type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); clearErr("consent"); }} />
            <span>
              Даю <a href={p.consentHref} target="_blank" rel="noopener noreferrer">согласие на обработку персональных данных</a>
              {fieldErr.consent && (
                <>
                  <br />
                  <span className="err" style={{ color: "inherit", fontWeight: 600 }}>{fieldErr.consent}</span>
                </>
              )}
            </span>
          </label>
          {/* Согласие — отдельно от других документов (ч. 1 ст. 9 152-ФЗ с 1 сентября 2025): политика своей строкой, без галочки */}
          <p className="consent-doc">
            <a href={p.privacyHref} target="_blank" rel="noopener noreferrer">Политика обработки персональных данных</a>
          </p>
          {p.captchaKey && <div ref={captchaRef} style={{ minHeight: 102, marginBottom: 12 }} />}
          {fieldErr.captcha && <p className="form-err">{fieldErr.captcha}</p>}
          {p.demo && <p className="demo-note">Это пример сайта: запись пробная, сервис её не получит. Имя и телефон не сохраняются.</p>}
          <button className="btn wide" type="submit" disabled={sending}>
            {sending ? "Записываем…" : "Записаться"}
          </button>
        </form>
      )}
    </section>
  );
}
