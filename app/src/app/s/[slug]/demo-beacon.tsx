"use client";

import { useEffect } from "react";

/**
 * Только в демо: сообщает, что владелец открыл сайт (или переключил стиль), админка показывает это у сервиса.
 * Срабатывает в браузере после загрузки, поэтому превью ссылки в мессенджерах не считается.
 * Перезагрузка и переключение стилей в той же вкладке — не новое открытие: отметка живёт в памяти вкладки, без cookie.
 */
export function DemoBeacon({ apiBase, slug }: { apiBase: string; slug: string }) {
  useEffect(() => {
    // Автоматический браузер (проверки, роботы) — не человек
    if (navigator.webdriver) return;
    const key = `avtoslot:seen:${slug}`;
    let seen = false;
    try {
      seen = sessionStorage.getItem(key) === "1";
      sessionStorage.setItem(key, "1");
    } catch {
      // Память вкладки недоступна (строгий приватный режим): считаем как открытие
    }
    const styled = new URLSearchParams(window.location.search).has("theme");
    if (seen && !styled) return;
    const body = JSON.stringify({ kind: seen ? "style" : "open" });
    const url = `${apiBase}/view`;
    if (!navigator.sendBeacon?.(url, body)) fetch(url, { method: "POST", body, keepalive: true }).catch(() => {});
  }, [apiBase, slug]);
  return null;
}
