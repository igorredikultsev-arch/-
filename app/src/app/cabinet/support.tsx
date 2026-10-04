import { brandContacts } from "@/lib/brand";

/** Куда писать владельцу: Telegram Автослота, если задан, иначе почта. Ничего не задано — просто «нам». */
export function supportHref() {
  const c = brandContacts();
  return c.telegram ?? (c.email ? `mailto:${c.email}` : null);
}

export function SupportLink({ children = "Написать нам" }: { children?: React.ReactNode }) {
  const href = supportHref();
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
      {children}
    </a>
  );
}
