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

// Títulos de sección: Cinzel, peso medio y sin rótulo encima (el título ya dice qué es).
const Title = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`font-display text-center text-[1.9rem] font-medium leading-tight tracking-[.02em] sm:text-[2.6rem] ${className}`}>{children}</h2>
);

// Burbujas de la membresía: posiciones fijas (mismo HTML en servidor y navegador).
const BUBBLES = Array.from({ length: 34 }, (_, i) => {
  const r = (n: number) => { const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
  return { x: `${Math.round(r(1) * 100)}%`, s: `${Math.round(6 + r(2) * 30)}px`, d: `${(7 + r(3) * 9).toFixed(1)}s`, w: `${(-r(4) * 14).toFixed(1)}s`, sway: `${Math.round((r(5) - 0.5) * 60)}px`, y: `${Math.round(10 + r(6) * 80)}%` };
});
const Bubbles = () => (
  <div className="lg-bubbles" aria-hidden>
    <div className="lg-caustic" />
    {BUBBLES.map((b, i) => (
      <span key={i} className="lg-bubble" style={{ "--x": b.x, "--s": b.s, "--d": b.d, "--w": b.w, "--sway": b.sway, "--y": b.y } as React.CSSProperties} />
    ))}
  </div>
);
const Drop = () => (
  <svg viewBox="0 0 20 24" className="mt-1 size-5 shrink-0" aria-hidden>
    <path d="M10 1C10 1 2 10.5 2 15.5a8 8 0 0 0 16 0C18 10.5 10 1 10 1Z" fill="#22d3ee" />
    <path d="M6.5 15.5a3.5 3.5 0 0 0 3.5 3.5" stroke="#e0fbff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
  </svg>
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
            <span className="font-display text-[15px] font-medium tracking-[.22em] text-gold">LUXE GARAGE</span>
          </a>
          <HelpButton {...help} />
        </div>
      </nav>

      <main>
        <LiveGarage hours={horario} mapsUrl={mapsLink} />

        <section id="reservar" className="mx-auto max-w-xl scroll-mt-16 px-5 py-20">
          <Title>Aparta tu lugar</Title>
          <p className="mt-3 text-center text-lg text-white/70">Elige qué lavamos y la hora, paga y listo.</p>
          <div className="mt-10">
            <BookingFlow prices={s.prices} hours={s.hours} today={today} mpPublicKey={mpKey} />
          </div>
        </section>

        {/* Membresía: tema agua, con burbujas */}
        <section id="membresia" className="water-bg relative scroll-mt-14 overflow-hidden px-5 py-24 text-white">
          <Bubbles />
          <svg className="lg-wave top-0 text-[#09090a]" style={{ "--d": "18s" } as React.CSSProperties} viewBox="0 0 1200 70" preserveAspectRatio="none" aria-hidden>
            <path fill="currentColor" d="M0 0h1200v28c-50 0-100 22-150 22S950 28 900 28 800 50 750 50 650 28 600 28 500 50 450 50 350 28 300 28 200 50 150 50 50 28 0 28Z" />
          </svg>
          <div className="relative mx-auto max-w-md text-center">
            <Title>Membresía</Title>
            <p className="mt-3 text-lg text-cyan-50/75">{s.membershipWashes} lavadas por dentro y por fuera</p>
            <div className="mt-8 rounded-[30px] border border-cyan-200/25 bg-white/[.07] p-7 shadow-[0_30px_80px_rgba(0,20,40,.45)] backdrop-blur-sm">
              <p className="num text-[4.25rem] font-light leading-none">${s.prices.suscripcion}</p>
              <p className="mt-2 text-base text-cyan-50/70">pago único · 30 días</p>
              <ul className="mt-7 space-y-3 text-left text-lg leading-snug text-white/90">
                <li className="flex gap-3"><Drop />{s.membershipWashes} lavadas completas dentro de 30 días.</li>
                <li className="flex gap-3"><Drop />Eliges tus {s.membershipWashes} fechas y turnos al comprar.</li>
                <li className="flex gap-3"><Drop />Va a tu nombre: trae el auto que quieras.</li>
                <li className="flex gap-3"><Drop />Tu turno queda apartado: llegas y pasas.</li>
              </ul>
              <MembershipFlow price={s.prices.suscripcion} washes={s.membershipWashes} hours={s.hours} today={today} mpPublicKey={mpKey} />
            </div>
          </div>
          <svg className="lg-wave bottom-0 text-[#dcd8cf]" style={{ "--d": "12s" } as React.CSSProperties} viewBox="0 0 1200 70" preserveAspectRatio="none" aria-hidden>
            <path fill="currentColor" d="M0 70h1200V42c-50 0-100-22-150-22s-100 22-150 22-100-22-150-22-100 22-150 22-100-22-150-22-100 22-150 22-100-22-150-22S50 42 0 42Z" />
          </svg>
        </section>

        {/* El lugar real: video sobre mosaico */}
        <section id="video" className="tile-mosaic px-5 pb-28 pt-20">
          <header className="mx-auto max-w-xl text-center">
            <Title className="text-[#141414]">Si está libre,<br />está libre</Title>
            <p className="mt-3 text-lg text-black/70">Azulejo, fosa de acero y un equipo que deja tu auto como nuevo.</p>
          </header>
          <div className="mx-auto mt-10 max-w-[21rem]">
            <RealVideo />
          </div>
        </section>

      </main>

      {/* Dirección y horario: una sola vez, al pie (antes era una sección aparte que repetía lo mismo). */}
      <footer id="visitanos" className="px-5 pb-12 pt-14 text-center text-white/70">
        <p className="font-display text-[15px] font-medium tracking-[.22em] text-gold">LUXE GARAGE</p>
        <p className="mt-4 text-base text-white/85">{BUSINESS.location}</p>
        <p className="mt-1 text-sm">{horario}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="text-gold underline-offset-4 hover:underline">Cómo llegar</a>
          <a href="/privacidad" className="underline-offset-4 hover:underline">Aviso de privacidad</a>
        </div>
        <p className="mt-6 text-xs text-white/45">© {new Date().getFullYear()} {BUSINESS.name}</p>
      </footer>

    </>
  );
}
