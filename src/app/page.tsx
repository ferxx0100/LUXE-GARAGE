import BookingFlow from "@/components/BookingFlow";
import HelpButton from "@/components/HelpButton";
import { localNow } from "@/lib/booking-core";
import LiveGarage from "@/components/LiveGarage";
import MembershipFlow from "@/components/MembershipFlow";
import RealVideo from "@/components/RealVideo";
import { BUSINESS, SITE_URL, mapsLink, telLink, whatsappLink } from "@/lib/config";
import { getSettings, hoursLabel } from "@/lib/settings";

// Página estática regenerada al guardar en /admin (y cada 5 min por si acaso).
export const revalidate = 300;

const Title = ({ kicker, children, dark }: { kicker: string; children: React.ReactNode; dark?: boolean }) => (
  <header className="text-center">
    <p className={`text-[11px] font-semibold tracking-[.4em] ${dark ? "text-[#8a6d1a]" : "text-gold/80"}`}>{kicker}</p>
    <h2 className="font-display mt-2 text-[1.9rem] leading-tight font-semibold sm:text-5xl">{children}</h2>
  </header>
);

export default async function Home() {
  const s = await getSettings();
  const horario = hoursLabel(s.hours);
  const today = localNow().date;
  const mpKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || null;
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
        <LiveGarage hours={horario} mapsUrl={mapsLink} street={`${BUSINESS.address.street}, ${BUSINESS.address.colonia}`} />

        <section id="reservar" className="mx-auto max-w-xl scroll-mt-16 px-5 pb-24 pt-20">
          <Title kicker="RESERVA EN LÍNEA">Aparta tu hora</Title>
          <p className="mt-3 text-center text-lg text-white/75">Tres pasos: qué lavamos, a qué hora y tus datos.</p>
          <div className="mt-10">
            <BookingFlow prices={s.prices} hours={s.hours} today={today} mpPublicKey={mpKey} />
          </div>
        </section>

        {/* El lugar real: video sobre mosaico */}
        <section id="video" className="tile-mosaic px-5 pb-28 pt-20">
          <header className="mx-auto max-w-xl text-center">
            <p className="text-[11px] font-semibold tracking-[.4em] text-[#8a6d1a]">EL LUGAR REAL</p>
            <h2 className="font-display mt-2 text-[1.9rem] font-semibold leading-tight text-[#141414] md:text-5xl">Así se ve por dentro</h2>
            <p className="mt-3 text-lg text-black/70">Azulejo blanco, rejillas de acero y un equipo que deja tu auto como nuevo.</p>
          </header>
          <div className="mx-auto mt-10 max-w-[21rem]">
            <RealVideo />
          </div>
        </section>

        {/* Membresía: azul marino y vino, sin adornos que distraigan */}
        <section id="membresia" className="water-bg relative scroll-mt-14 px-5 py-24 text-white">
          <div className="relative mx-auto max-w-md">
            <header className="text-center">
              <p className="text-[11px] font-semibold tracking-[.4em] text-[#a9c4ff]">MEMBRESÍA</p>
              <h2 className="font-display mt-2 text-[1.9rem] leading-tight font-semibold sm:text-5xl">Para los que lavan seguido</h2>
              <p className="mt-3 text-lg text-white/80">Pagas una vez y tienes {s.subscriptionWashes} lavadas en 30 días, <b className="text-white">de jueves a sábado</b>, con tus días y horas ya apartados.</p>
            </header>
            <div className="mt-8 rounded-3xl border border-white/12 bg-white/[.06] p-6 shadow-[0_30px_80px_rgba(5,10,30,.4)]">
              <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="text-sm text-white/65">Precio</p>
                  <p className="text-5xl font-extrabold leading-none tabular-nums">${s.prices.suscripcion}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-extrabold leading-none">{s.subscriptionWashes} lavadas</p>
                  <p className="mt-1 text-sm text-white/65">≈ ${Math.round(s.prices.suscripcion / s.subscriptionWashes)} cada una{s.prices.carro > s.prices.suscripcion / s.subscriptionWashes ? ` (normal $${s.prices.carro})` : ""}</p>
                </div>
              </div>
              <ol className="mt-5 space-y-4">
                {[
                  ["Paga una sola vez", `$${s.prices.suscripcion} con tarjeta, aquí mismo.`],
                  [`Elige tus ${s.subscriptionWashes} días`, "Jueves, viernes o sábado, y la hora de cada uno."],
                  ["Llega y pasa", "Tu lugar ya es tuyo: sin fila, sin cita extra."],
                ].map(([t, d], i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#8e2348] text-base font-extrabold ring-2 ring-[#a9c4ff]/30">{i + 1}</span>
                    <span><b className="block text-lg leading-snug">{t}</b><span className="block text-base text-white/70">{d}</span></span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 rounded-2xl bg-white/[.06] px-4 py-3 text-sm text-white/75">Sirve para <b className="text-white">exterior e interior</b> o <b className="text-white">solo exterior</b>.</p>
              <MembershipFlow price={s.prices.suscripcion} washes={s.subscriptionWashes} prices={s.prices} hours={s.hours} today={today} mpPublicKey={mpKey} />
            </div>
          </div>
        </section>

        <section id="visitanos" className="mx-auto max-w-5xl px-5 py-20 text-center">
          <Title kicker="VISÍTANOS">{BUSINESS.address.street}</Title>
          <p className="mt-4 text-white/85">{BUSINESS.address.colonia}, {BUSINESS.address.cp} {BUSINESS.address.city}, {BUSINESS.address.state}</p>
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
