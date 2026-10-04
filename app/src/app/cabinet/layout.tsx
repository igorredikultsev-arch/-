import type { Metadata, Viewport } from "next";
import { closeCabinet } from "@/app/admin/actions";
import { requireOwner } from "@/lib/auth";
import { Tabbar } from "./tabbar";

export const metadata: Metadata = { title: "Кабинет", robots: { index: false }, manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { themeColor: "#eef0f3" };

export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  const { asAdmin, business } = await requireOwner();
  return (
    <div className="min-h-dvh bg-paper text-ink">
      {asAdmin && (
        <div className="sticky top-0 z-20 bg-ink text-white">
          <form action={closeCabinet} className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-2.5 text-[13.5px]">
            <span className="min-w-0">{business.name}: вы в кабинете как администратор, изменения сразу видны клиенту</span>
            <button className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 font-semibold">В админку</button>
          </form>
        </div>
      )}
      <main className="mx-auto max-w-md pb-32">{children}</main>
      <Tabbar />
    </div>
  );
}
