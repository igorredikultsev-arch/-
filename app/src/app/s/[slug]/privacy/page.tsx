import type { Metadata } from "next";
import { getSiteBusiness } from "@/lib/business";
import { PRIVACY_TITLE, privacyText, processor } from "@/lib/legal";
import { formatPhone } from "@/lib/phone";
import { siteBase } from "@/lib/site-url";
import { Doc } from "../doc";

export const metadata: Metadata = { title: PRIVACY_TITLE };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const key = decodeURIComponent((await params).slug);
  const biz = (await getSiteBusiness(key))!;
  const op = {
    name: biz.operatorName || biz.name,
    inn: biz.operatorInn,
    address: `${biz.city}, ${biz.address}`,
    phone: formatPhone(biz.phone),
  };
  const base = await siteBase(key);
  return <Doc title={PRIVACY_TITLE} sections={privacyText(op, biz.name, processor())} back={base || "/"} />;
}
