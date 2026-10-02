import { Oswald, Onest, Russo_One } from "next/font/google";
import { notFound } from "next/navigation";
import { getSiteBusiness, isPublic } from "@/lib/business";
import { onAccent } from "@/lib/color";
import "../site.css";

const russo = Russo_One({ subsets: ["latin", "cyrillic"], weight: "400", variable: "--font-russo", display: "swap" });
const onest = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-onest", display: "swap" });
const oswald = Oswald({ subsets: ["latin", "cyrillic"], variable: "--font-oswald", display: "swap" });

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const biz = await getSiteBusiness(decodeURIComponent((await params).slug));
  if (!biz || biz.status === "archived") notFound();
  const expiredDemo = biz.status === "demo" && biz.demoExpiresAt && biz.demoExpiresAt.getTime() < Date.now();
  if (expiredDemo) notFound();
  return (
    <div
      className={`site t-${biz.theme} ${russo.variable} ${onest.variable} ${oswald.variable}`}
      style={{ "--accent": biz.accent, "--on-accent": onAccent(biz.accent) } as React.CSSProperties}
    >
      <div className="page">
        {isPublic(biz.status) ? children : <p className="closed-note">Сайт временно недоступен. Позвоните в сервис: {biz.phone}</p>}
      </div>
    </div>
  );
}
