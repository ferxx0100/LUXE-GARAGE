import HelpButton from "@/components/HelpButton";
import PlanCard from "@/components/PlanCard";
import LiveGarage from "@/components/LiveGarage";
import RealVideo from "@/components/RealVideo";
import ReserveSheet from "@/components/ReserveSheet";
import SingleWashButton from "@/components/SingleWashButton";
import { BUSINESS, SITE_URL, mapsLink, telLink, whatsappLink } from "@/lib/config";
import { seatsLeft } from "@/lib/members";
import { getSettings, hoursLabel } from "@/lib/settings";

// Página estática regenerada al guardar en /admin (y cada 5 min por si acaso).
export const revalidate = 300;

export default async function Home() {
  const s = await getSettings();
  const horario = hoursLabel(s.hours);
  const mpKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || null;
  const seats = await seatsLeft().catch(() => 1);
  const help = { tel: telLink, whatsapp: whatsappLink("Hola, necesito ayuda con LUXE GARAGE"), phoneDisplay: BUSINESS.phoneDisplay, hours: horario };

  // Datos para Google: negocio local con logo, teléfono, horario y precios.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoWash",
    name: BUSINESS.name,
    url: SITE_URL,
    logo: `${SITE_URL}/brand/google/emblem-1024.png`,
    image: `${SITE_URL}/brand/google/logo-1024.png`,
    telephone: `+${BUSINESS.phone}`,
    address: { "@type": "PostalAddress", streetAddress: `${BUSINESS.address.street}, ${BUSINESS.address.colonia}`, postalCode: BUSINESS.address.cp, addressLocality: BUSINESS.address.city, addressRegion: BUSINESS.address.state, addressCountry: "MX" },
    hasMap: mapsLink,
    geo: { "@type": "GeoCoordinates", latitude: BUSINESS.geo.lat, longitude: BUSINESS.geo.lng },
    openingHoursSpecification: s.hours.flatMap((d, i) => d ? [{
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i],
      opens: `${String(d.open).padStart(2, "0")}:00`,
      closes: `${String(d.close % 24).padStart(2, "0")}:00`,
    }] : []),
    priceRange: `$${s.single.carro}–$${s.socio.camioneta}`,
  };

  return (
    <>
      {/* JSON generado por nosotros (sin texto de usuarios); "<" escapado por seguridad */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {s.notice && <div className="bg-gold px-4 py-2.5 text-center text-sm font-semibold text-ink" role="note">{s.notice}</div>}

      <nav className="sticky top-0 z-40 border-b border-white/5 bg-ink/85 backdrop-blur-md" aria-label="Principal">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <a href="#" className="flex items-center gap-2.5" aria-label="LUXE GARAGE, inicio">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/emblem-128.png" alt="" width="34" height="34" />
            <span className="font-display text-[15px] font-semibold tracking-[.22em] text-gold">LUXE GARAGE</span>
          </a>
          <div className="flex items-center gap-2">
            <a href="/socio" className="hidden min-h-11 items-center rounded-full border border-white/20 px-4 text-sm font-semibold sm:inline-flex">Mi cuenta</a>
            <HelpButton {...help} />
          </div>
        </div>
      </nav>

      <main>
        <LiveGarage mapsUrl={mapsLink} />

        {/* Lo principal: la suscripción, presentada como plan. */}
        <section id="membresia" className="scroll-mt-14 px-5 pb-14 pt-14 text-white">
          <div className="mx-auto max-w-md">
            <PlanCard prices={s.socio} washes={s.membershipWashes} mpPublicKey={mpKey} seats={seats} />
          </div>
        </section>

        {/* El lugar real: solo el video, grande. */}
        <section id="video" aria-label="Video del lugar" className="px-4 pb-14">
          <div className="mx-auto max-w-md"><RealVideo /></div>
        </section>

        {/* Secundario: lavada normal */}
        <section id="suelta" className="scroll-mt-14 px-5 pb-16">
          <div className="mx-auto max-w-md rounded-[28px] border border-white/10 bg-white/[.03] p-6">
            <h2 className="text-xl font-semibold text-white">Lavada normal</h2>
            <p className="mt-1 text-base text-white/60">Exterior y aspirado de interior</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {(["carro", "camioneta"] as const).map((v) => (
                <div key={v} className="rounded-2xl bg-white/[.04] px-4 py-3">
                  <p className="text-sm text-white/60">{v === "carro" ? "Carro" : "Camioneta"}</p>
                  <p className="num text-2xl font-bold text-white">${s.single[v]}</p>
                </div>
              ))}
            </div>
            <div className="mt-5"><SingleWashButton /></div>
          </div>
        </section>

        <section id="visitanos" className="border-t border-white/10 px-5 py-12 text-center">
          <p className="text-base font-bold">{BUSINESS.address.street}</p>
          <p className="mt-1 text-sm text-white/70">{BUSINESS.address.colonia}, {BUSINESS.address.cp} {BUSINESS.address.city}</p>
          <p className="mt-1 text-sm text-white/70">{horario}</p>
          <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="btn-line mt-6 min-h-12 px-6">Cómo llegar</a>
        </section>
      </main>

      <footer className="px-5 pb-12 pt-6 text-center text-sm text-white/50">
        <p className="font-display tracking-[.2em] text-gold">LUXE GARAGE</p>
        <p className="mt-2"><a href="/privacidad" className="underline underline-offset-4">Aviso de privacidad</a> · © {new Date().getFullYear()} {BUSINESS.name}</p>
      </footer>

      <ReserveSheet hours={s.hours} prices={s.single} mpPublicKey={mpKey} />
    </>
  );
}
