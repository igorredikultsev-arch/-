"use client";

import { useState } from "react";
import { THEMES, type ThemeKey } from "@/lib/themes";

/** Только в демо: владелец смотрит сайт в трёх стилях и выбирает свой. Выбор сохраняется, его видно в админке. */
export function ThemeSwitch({ shown, saved, chosen, apiBase, pagePath }: { shown: ThemeKey; saved: ThemeKey; chosen: boolean; apiBase: string; pagePath: string }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const isChosen = chosen && shown === saved;

  async function choose() {
    setState("saving");
    const r = await fetch(`${apiBase}/theme`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: shown }) }).catch(() => null);
    if (r?.ok) {
      setState("done");
      window.location.href = pagePath;
    } else setState("error");
  }

  return (
    <div className="switch" role="region" aria-label="Выбор стиля сайта">
      <p className="switch-note">Демо-версия. Посмотрите сайт в трёх стилях и выберите свой</p>
      <div className="switch-row">
        <nav className="switch-tabs" aria-label="Стиль сайта">
          {THEMES.map((t) => (
            <a key={t.value} href={`${pagePath}?theme=${t.value}`} aria-current={t.value === shown ? "page" : undefined}>
              {t.label}
            </a>
          ))}
        </nav>
        {isChosen ? (
          <span className="switch-ok">Этот стиль выбран</span>
        ) : (
          <button type="button" className="switch-go" onClick={choose} disabled={state === "saving" || state === "done"}>
            {state === "saving" || state === "done" ? "Сохраняем…" : "Выбрать этот стиль"}
          </button>
        )}
      </div>
      {state === "error" && <p className="switch-err">Не получилось сохранить. Обновите страницу и попробуйте ещё раз</p>}
    </div>
  );
}
