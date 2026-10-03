import type { Metadata } from "next";
import { OWN_PRIVACY_TITLE, ownPrivacyText, processor } from "@/lib/legal";
import { LegalPage } from "../legal-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: OWN_PRIVACY_TITLE };

export default function PrivacyPage() {
  return <LegalPage title={OWN_PRIVACY_TITLE} sections={ownPrivacyText(processor())} />;
}
