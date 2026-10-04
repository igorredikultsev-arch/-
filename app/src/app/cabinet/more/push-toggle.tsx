"use client";

import { useEffect, useState, useTransition } from "react";
import { removePushSubscription, savePushSubscription, testPush, type ActionResult } from "../actions";
import { btnPrimary, btnSecondary, Notice } from "../ui";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

function keyBytes(base64: string) {
  const b = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/cabinet" });
}

/** Включить, проверить и выключить уведомления о записях на этом телефоне. */
export function PushToggle({ publicKey, devices }: { publicKey: string; devices: number }) {
  const [state, setState] = useState<State>("loading");
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // На iPhone уведомления есть только у кабинета, добавленного на экран «Домой»
        setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await registration();
      setState((await reg.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = () =>
    start(async () => {
      setResult(null);
      try {
        if ((await Notification.requestPermission()) !== "granted") return setState("denied");
        const reg = await registration();
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
        const r = await savePushSubscription(sub.toJSON());
        if (r?.error) return setResult(r);
        setState("on");
        setResult(await testPush());
      } catch {
        setResult({ error: "Не получилось включить уведомления на этом телефоне. Обновите страницу и попробуйте ещё раз" });
      }
    });

  const disable = () =>
    start(async () => {
      setResult(null);
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setState("off");
    });

  return (
    <div className="grid gap-3 text-[14px] leading-snug text-zinc-700">
      {state === "loading" && <p className="text-zinc-500">Проверяем телефон…</p>}
      {state === "ios-install" && (
        <Notice tone="warn">
          На iPhone уведомления работают только у кабинета на экране «Домой». Откройте кабинет в Safari, нажмите «Поделиться», затем «На экран Домой»,
          откройте кабинет с экрана и вернитесь сюда.
        </Notice>
      )}
      {state === "unsupported" && <Notice tone="warn">Этот браузер не умеет показывать уведомления. Откройте кабинет в Chrome на Android или в Safari на iPhone.</Notice>}
      {state === "denied" && (
        <Notice tone="warn">Уведомления для кабинета запрещены в настройках телефона. Разрешите их в настройках браузера для этого сайта и обновите страницу.</Notice>
      )}
      {state === "off" && (
        <>
          <p>Включите, чтобы сразу узнавать о новых записях с сайта и об отменах. В уведомлении — день, время и услуга, имя и телефон клиента видны в кабинете.</p>
          <button type="button" disabled={pending} onClick={enable} className={btnPrimary}>Включить уведомления</button>
        </>
      )}
      {state === "on" && (
        <>
          <p className="font-semibold text-emerald-700">Уведомления на этом телефоне включены</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={pending} onClick={() => start(async () => setResult(await testPush()))} className={btnSecondary}>Проверить</button>
            <button type="button" disabled={pending} onClick={disable} className={btnSecondary}>Выключить</button>
          </div>
        </>
      )}
      {devices > 0 && <p className="text-[13px] text-zinc-500">Телефонов с уведомлениями: {devices}</p>}
      {result?.error && <Notice tone="error">{result.error}</Notice>}
      {result?.ok && result.message && <Notice tone="ok">{result.message}</Notice>}
    </div>
  );
}
