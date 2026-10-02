/** Приводит российский номер к виду +7XXXXXXXXXX. null — если номер не похож на российский мобильный или городской. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.length === 11 && (d[0] === "8" || d[0] === "7")) d = d.slice(1);
  if (d.length !== 10) return null;
  return `+7${d}`;
}

/** +73422541873 → +7 (342) 254-18-73 */
export function formatPhone(p: string): string {
  const d = p.replace(/\D/g, "").slice(-10);
  if (d.length !== 10) return p;
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
}
