// События между блоками сайта и формой записи. Блоки живут отдельно, общаются через window.
export const PICK_EVENT = "avtoslot:pick-service"; // detail: id услуги
export const SLOT_EVENT = "avtoslot:pick-slot"; // detail: SlotPick, сразу к контактам
export const STATE_EVENT = "avtoslot:state"; // detail: BookState, форма сообщает о выборе

export type SlotPick = { serviceId: string; date: string; time: string };
export type BookState = { serviceId: string | null; date: string | null; time: string | null };

export function scrollToBook() {
  document.getElementById("book")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

export function pickSlot(detail: SlotPick) {
  window.dispatchEvent(new CustomEvent(SLOT_EVENT, { detail }));
  scrollToBook();
}
