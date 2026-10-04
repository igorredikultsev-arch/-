import type { Metadata } from "next";
import { OFFER_TITLE, offerText, processor } from "@/lib/legal";
import { GUARANTEE_DAYS, MONTHLY_PRICE, SETUP_PRICE, UNPAID_GRACE_DAYS, rub } from "@/lib/pricing";
import { LegalPage } from "../legal-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: OFFER_TITLE };

export default function OfferPage() {
  return <LegalPage title={OFFER_TITLE} sections={offerText(processor(), { setup: rub(SETUP_PRICE), monthly: rub(MONTHLY_PRICE), guaranteeDays: GUARANTEE_DAYS, graceDays: UNPAID_GRACE_DAYS })} />;
}
