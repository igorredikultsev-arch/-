"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDayLong, formatDayShort } from "@/lib/time";
import { PICK_EVENT } from "./services-list";

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
};

declare global {
  interface Window {
    smartCaptcha?: { render: (el: HTMLElement, opts: { sitekey: string; hl?: string; callback?: (t: string) => void }) => number; reset: (id?: number) => void };
  }
}

const freeWord = (n: number) =>
  n % 10 === 1 && n % 100 !== 11 ? "свободное окно" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "свободных окна" : "свободных окон";

/** +7 (342) 254-18-73 по мере ввода */
function maskPhone(v: string) {
  let d = v.replace(/\D/g, "");
  if (d.startsWith("8") || d.startsWith("7")) d = d.slice(1);
  d = d.slice(0, 10);
  let out = "+7";
  if (d.length) out += ` (${d.slice(0, 3)}`;
  if (d.length >= 3) out += ")";
  if (d.length > 3) out += ` ${d.slice(3, 6)}`;
  if (d.length > 6) out += `-${d.slice(6, 8)}`;
  if (d.length > 8) out += `-${d.slice(8, 10)}`;
  return out;
}

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
  const hpRef = useRef<HTMLInputElement>(null);
  const captchaRef = useRef<HTMLDivElement>(null);
  const captchaId = useRef<number | null>(null);

  const service = p.services.find((s) => s.id === serviceId) ?? null;

  const loadSlots = useCallback(
    async (sid: string, d: string) => {
      setSlots(null);
      const r = await fetch(`${p.apiBase}/slots?service=${sid}&date=${d}`);
      const data = await r.json();
      setSlots(r.ok ? data.slots : []);
    },
    [p.apiBase],
  );

  const chooseService = useCallback(
    async (sid: string) => {
      setServiceId(sid);
      setTime(null);
      setStep(2);
      setDays(null);
      setSlots(null);
      const r = await fetch(`${p.apiBase}/days?service=${sid}`);
      const data = await r.json();
      const list: Day[] = r.ok ? data.days : [];
      setDays(list);
      const first = list.find((x) => x.free > 0) ?? list.find((x) => !x.closed);
      if (first) {
        setDate(first.date);
        loadSlots(sid, first.date);
      } else setSlots([]);
    },
    [p.apiBase, loadSlots],
  );

  useEffect(() => {
    const on = (e: Event) => chooseService((e as CustomEvent<string>).detail);
    window.addEventListener(PICK_EVENT, on);
    return () => window.removeEventListener(PICK_EVENT, on);
  }, [chooseService]);

  // Яндекс SmartCaptcha на шаге контактов
  useEffect(() => {
    if (step !== 3 || !p.captchaKey || !captchaRef.current) return;
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
    document.head.appendChild(s);
  }, [step, p.captchaKey]);

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
      if (data.code === "slot_taken") {
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
            {service.name}, {service.durationMin} мин
          </span>
          <button type="button" onClick={() => { setStep(1); setNotice(null); }}>
            Изменить
          </button>
        </div>
      )}

      {step === 2 && service && (
        <>
          <div className="days" role="group" aria-label="День">
            {days === null && <div className="skeleton" style={{ height: 62, width: "100%" }} />}
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
                  <em>{d.closed ? "выходной" : i === 0 ? "сегодня" : d.free === 0 ? "занято" : ""}</em>
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
            {slots === null && <div className="skeleton" />}
            {slots?.length === 0 && <div className="slots-empty">В этот день записаться нельзя. Выберите другой.</div>}
            {slots && slots.length > 0 && freeCount === 0 && <div className="slots-empty">Всё занято. Выберите другой день.</div>}
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
            <input id="bk-name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-invalid={!!fieldErr.name} />
            {fieldErr.name && <span className="err">{fieldErr.name}</span>}
          </div>
          <div className="field">
            <label htmlFor="bk-phone">Телефон</label>
            <input id="bk-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} aria-invalid={!!fieldErr.phone} />
            {fieldErr.phone && <span className="err">{fieldErr.phone}</span>}
          </div>
          <div className="field">
            <label htmlFor="bk-car">Марка и модель машины</label>
            <input id="bk-car" placeholder="Например, Kia Rio" value={car} onChange={(e) => setCar(e.target.value)} maxLength={60} aria-invalid={!!fieldErr.car} />
            {fieldErr.car && <span className="err">{fieldErr.car}</span>}
          </div>
          <div className="field">
            <label htmlFor="bk-comment">{service.isDiagnostic ? "Что беспокоит в машине" : "Комментарий, если нужно"}</label>
            <textarea
              id="bk-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              placeholder={service.isDiagnostic ? "Например, стучит спереди справа на кочках" : ""}
              aria-invalid={!!fieldErr.comment}
            />
            {fieldErr.comment && <span className="err">{fieldErr.comment}</span>}
          </div>
          <input ref={hpRef} className="hp" tabIndex={-1} autoComplete="off" name="website" aria-hidden="true" />
          <label className="consent" htmlFor="bk-consent">
            <input id="bk-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              Даю <a href={p.consentHref} target="_blank" rel="noopener">согласие на обработку персональных данных</a> по{" "}
              <a href={p.privacyHref} target="_blank" rel="noopener">политике</a>
              {fieldErr.consent && (
                <>
                  <br />
                  <span className="err" style={{ color: "inherit", fontWeight: 600 }}>{fieldErr.consent}</span>
                </>
              )}
            </span>
          </label>
          {p.captchaKey && <div ref={captchaRef} style={{ minHeight: 102, marginBottom: 12 }} />}
          {fieldErr.captcha && <p className="form-err">{fieldErr.captcha}</p>}
          <button className="btn wide" type="submit" disabled={sending}>
            {sending ? "Записываем…" : "Записаться"}
          </button>
        </form>
      )}
    </section>
  );
}
