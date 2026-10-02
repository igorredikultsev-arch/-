import type { Metadata, Viewport } from "next";
import { requireOwner } from "@/lib/auth";
import { Tabbar } from "./tabbar";

export const metadata: Metadata = { title: "Кабинет", robots: { index: false }, manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { themeColor: "#eef0f3" };

export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <main className="mx-auto max-w-md pb-32">{children}</main>
      <Tabbar />
    </div>
  );
}
