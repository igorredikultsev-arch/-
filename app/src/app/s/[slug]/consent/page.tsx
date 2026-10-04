import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteBusiness, decodeKey } from "@/lib/business";
import { CONSENT_TITLE, consentText, processor } from "@/lib/legal";
import { formatPhone } from "@/lib/phone";
import { siteBase } from "@/lib/site-url";
import { Doc } from "../doc";

// Документы поисковикам не нужны, а у демо их нельзя показывать в поиске вовсе
export const metadata: Metadata = { title: CONSENT_TITLE, robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const key = decodeKey((await params).slug);
  const biz = await getSiteBusiness(key);
  // Макет тоже отвечает «не найдено», но страница рисуется параллельно с ним и не должна падать
  if (!biz) notFound();
  const op = {
    name: biz.operatorName || biz.name,
    inn: biz.operatorInn,
    address: `${biz.city}, ${biz.address}`,
    phone: formatPhone(biz.phone),
  };
  const base = await siteBase(key);
  return <Doc title={CONSENT_TITLE} sections={consentText(op, biz.name, processor())} back={base || "/"} />;
}
