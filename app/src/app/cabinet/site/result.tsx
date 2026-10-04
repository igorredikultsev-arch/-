import type { ActionResult } from "../actions";
import { btnPrimary, Notice } from "../ui";

export function Result({ state }: { state: ActionResult }) {
  if (state?.error) return <Notice tone="error">{state.error}</Notice>;
  if (state?.ok) return <Notice tone="ok">{state.message}</Notice>;
  return null;
}

/** Кнопка сохранения, прилипшая к низу экрана над нижним меню: длинную форму не нужно пролистывать до конца. */
export function SaveBar({ pending, label }: { pending: boolean; label: string }) {
  return (
    <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-10 -mx-[18px] bg-gradient-to-t from-paper from-70% to-transparent px-[18px] pb-2 pt-4 lg:bottom-0 lg:mx-0 lg:px-0 lg:pb-6">
      <button disabled={pending} className={`${btnPrimary} w-full`}>{pending ? "Сохраняем…" : label}</button>
    </div>
  );
}
