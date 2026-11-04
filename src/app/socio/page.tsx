import SocioApp from "@/components/SocioApp";
import { telLink } from "@/lib/config";
import { getSettings } from "@/lib/settings";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi cuenta de socio | LUXE GARAGE", robots: { index: false, follow: false } };

// Cuenta del socio: entra con celular + NIP; ve su tarjeta (sello vivo) y aparta sus lavadas del mes.
export default async function Socio() {
  const s = await getSettings();
  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-clip px-5 pb-16 pt-6">
      <a href="/" className="font-display text-sm font-semibold tracking-[.22em] text-gold">← LUXE GARAGE</a>
      <div className="mt-6">
        <SocioApp hours={s.hours} prices={s.socio} washesPerMonth={s.membershipWashes} mpPublicKey={(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? "").replace(/\s+/g, "") || null} help={telLink} />
      </div>
    </main>
  );
}
