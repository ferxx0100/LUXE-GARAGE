import BookingFlow from "@/components/BookingFlow";
import HelpButton from "@/components/HelpButton";
import { localNow } from "@/lib/booking-core";
import LiveGarage from "@/components/LiveGarage";
import RealVideo from "@/components/RealVideo";
import TileRoom from "@/components/TileRoom";
import { BUSINESS, SITE_URL, mapsLink, telLink, whatsappLink } from "@/lib/config";
import { getSettings, hoursLabel } from "@/lib/settings";

// Página estática regenerada al guardar en /admin (y cada 5 min por si acaso).
export const revalidate = 300;

const Title = ({ kicker, children, dark }: { kicker: string; children: React.ReactNode; dark?: boolean }) => (
  <header className="text-center">
    <p className={`text-[11px] font-semibold tracking-[.4em] ${dark ? "text-[#8a6d1a]" : "text-gold/80"}`}>{kicker}</p>
    <h2 className="font-display mt-3 text-[2rem] leading-tight font-semibold sm:text-5xl">{children}</h2>
  </header>
);

export default async function Home() {
  const s = await getSettings();
  const horario = hoursLabel(s.hours);
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
    address: { "@type": "PostalAddress", streetAddress: "Las Palomas", addressLocality: "Zamora", addressRegion: "Michoacán", addressCountry: "MX" },
    openingHoursSpecification: s.hours.flatMap((d, i) => d ? [{
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i],
      opens: `${String(d.open).padStart(2, "0")}:00`,
      closes: `${String(d.close % 24).padStart(2, "0")}:00`,
    }] : []),
    priceRange: `$${s.prices.carro}–$${s.prices.camioneta}`,
  };

  return (
    <>
      {/* JSON generado por nosotros (sin texto de usuarios); "<" escapado por seguridad */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {s.notice && <div className="bg-gold px-4 py-2.5 text-center text-sm font-semibold text-ink" role="note">{s.notice}</div>}

      {/* Barra fija: la marca y la ayuda siempre a la vista, sin tapar contenido */}
      <nav className="sticky top-0 z-40 border-b border-white/5 bg-ink/80 backdrop-blur-md" aria-label="Principal">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <a href="#" className="flex items-center gap-2.5" aria-label="LUXE GARAGE, inicio">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/emblem-128.png" alt="" width="34" height="34" />
            <span className="font-display text-[15px] font-semibold tracking-[.22em] text-gold">LUXE GARAGE</span>
          </a>
          <HelpButton {...help} />
        </div>
      </nav>

      <main>
        <LiveGarage hours={horario} mapsUrl={mapsLink} />

        <section id="reservar" className="mx-auto max-w-xl scroll-mt-16 px-5 py-20">
          <Title kicker="RESERVA EN LÍNEA">Aparta tu hora</Title>
          <p className="mt-4 text-center text-xl text-white/85">Elige la hora, paga y listo.</p>
          <div className="mt-10">
            <BookingFlow prices={s.prices} hours={s.hours} today={localNow().date} mpPublicKey={process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || null} />
          </div>
        </section>

        <div className="hairline mx-auto max-w-3xl" />

        <section id="suscripcion" className="mx-auto max-w-5xl px-5 py-20">
          <Title kicker="SUSCRIPCIÓN MENSUAL">{s.subscriptionWashes} lavadas al mes</Title>
          <div className="mx-auto mt-10 max-w-md rounded-3xl border border-gold/50 bg-gradient-to-b from-gold/[.12] to-transparent p-7 text-center">
            <p className="font-display text-gold-grad text-6xl font-semibold">${s.prices.suscripcion}</p>
            <p className="mt-1 text-sm text-white/75">al mes</p>
            <ul className="mt-6 space-y-3 text-left text-lg text-white/90">
              <li>✓ Eliges tus {s.subscriptionWashes} días del mes.</li>
              <li>✓ Sin cita: si el garage está libre, pasas.</li>
              <li>✓ Exterior e interior, o solo exterior sin bajarte.</li>
              <li>✓ A domicilio: +${s.prices.domicilio} por cada ida.</li>
            </ul>
            <p className="mt-6 text-xs text-white/60">Suscripción en línea muy pronto.</p>
          </div>
        </section>

        <TileRoom title={<>
          <p className="text-xs font-bold tracking-[.4em] text-[#8a6d1a] md:text-sm">EL LUGAR REAL</p>
          <h2 className="font-display mt-2 text-[2rem] font-semibold leading-tight text-[#141414] md:text-6xl">Si está libre,<br />está libre</h2>
          <p className="mt-3 text-lg text-black/75 md:text-2xl">Azulejo, fosa de acero y un equipo que deja tu auto como nuevo.</p>
        </>}>
          <RealVideo />
        </TileRoom>

        <section id="visitanos" className="mx-auto max-w-5xl px-5 py-20 text-center">
          <Title kicker="VISÍTANOS">{BUSINESS.location.split(",")[0]}</Title>
          <p className="mt-4 text-white/85">{BUSINESS.location}</p>
          <p className="mt-1 text-white/85">Horario: {horario}</p>
          <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="btn-line mt-8">Abrir en Mapas</a>
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 pb-12 pt-10 text-center text-sm text-white/60">
        <p className="font-display tracking-[.2em] text-gold">LUXE GARAGE</p>
        <p className="mt-2">© {new Date().getFullYear()} {BUSINESS.name}. Todos los derechos reservados.</p>
      </footer>

    </>
  );
}
