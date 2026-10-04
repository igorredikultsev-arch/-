"use client";

import { useActionState } from "react";
import { acceptOffer } from "./actions";
import { btnPrimary, Notice } from "./ui";

/** Перед работой в кабинете владелец принимает условия оферты (один раз на редакцию). */
export function OfferGate({ edition, name }: { edition: string; name: string }) {
  const [state, action, pending] = useActionState(acceptOffer, null);
  return (
    <form action={action} className="grid gap-4 px-[18px] pt-8">
      <div className="text-[13.5px] text-zinc-500">{name}</div>
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">Условия работы</h1>
      <p className="text-[15px] leading-relaxed text-zinc-700">
        Перед началом работы прочитайте договор-оферту: что входит в сервис, как устроена оплата и гарантия возврата, как мы храним данные ваших клиентов.
      </p>
      <a href="/offer" target="_blank" rel="noopener" className="justify-self-start text-[15px] font-semibold text-accent underline underline-offset-4">
        Договор-оферта, редакция от {edition}
      </a>
      <label className="flex items-start gap-3 rounded-xl bg-white p-4 text-[15px] leading-snug">
        <input type="checkbox" name="agree" className="mt-0.5 size-5 shrink-0 accent-accent" />
        <span>Принимаю условия договора-оферты, в том числе поручение на обработку персональных данных моих клиентов (раздел 7)</span>
      </label>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <button disabled={pending} className={btnPrimary}>Принимаю, перейти в кабинет</button>
    </form>
  );
}
