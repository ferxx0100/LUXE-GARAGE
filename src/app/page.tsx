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
  const mpKey = (process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? "").replace(/\s+/g, "") || null;
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
    priceRange: `$${s.single.carro}–$${s.detail.suv}`,
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
            <PlanCard prices={s.socio} single={s.single} washes={s.membershipWashes} mpPublicKey={mpKey} seats={seats} />
          </div>
        </section>

        {/* El lugar real: solo el video, grande. */}
        <section id="video" aria-label="Video del lugar" className="px-4 pb-14">
          <div className="mx-auto max-w-md"><RealVideo /></div>
        </section>

        {/* Lavados de una sola vez (sin membresía): del más completo al más sencillo. */}
        <section id="suelta" className="scroll-mt-14 px-5 pb-16" aria-labelledby="lavados">
          <div className="mx-auto grid max-w-md gap-4">
            <h2 id="lavados" className="font-display text-center text-2xl font-semibold text-gold">Lavados sin membresía</h2>

            {/* Detallado premium: la ficha más elegante */}
            <article className="relative overflow-hidden rounded-[28px] border border-gold/60 bg-[linear-gradient(155deg,#2a200a_0%,#141109_45%,#0b0b0c_100%)] p-6 shadow-[0_30px_60px_-28px_rgba(212,175,55,.55)]">
              <div className="pointer-events-none absolute -left-20 -top-24 size-56 rounded-full bg-gold/15 blur-3xl" aria-hidden />
              <div className="relative flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[.28em] text-gold">Premium</p>
                <span className="rounded-full border border-gold/50 px-3 py-1 text-xs font-semibold text-gold">El más completo</span>
              </div>
              <h3 className="font-display relative mt-3 text-[1.9rem] font-semibold leading-tight text-white">Detallado premium</h3>
              <p className="relative mt-1 text-base text-white/70">Cuidado a mano para que tu auto quede como nuevo.</p>
              <ul className="relative mt-5 grid gap-2.5 text-[1.02rem] text-white/85">
                {["Lavado a mano a detalle con shampoo pH neutro que cuida la pintura", "Aspirado profundo: asientos, tapetes, alfombras y cajuela", "Limpieza de tablero, puertas, plásticos y vidrios", "Encerado de carrocería", "Limpieza y abrillantado de faros", "Llantas y rines a detalle"].map((t) => (
                  <li key={t} className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden />{t}</li>
                ))}
              </ul>
              <p className="relative mt-3 text-sm text-white/50">No incluye pulido.</p>
              <div className="relative mt-5 grid grid-cols-3 gap-2">
                {(["carro", "camioneta", "suv"] as const).map((v) => (
                  <div key={v} className="rounded-2xl border border-gold/25 bg-black/30 px-3 py-3">
                    <p className="text-[13px] leading-tight text-white/60">{v === "carro" ? "Carro" : v === "camioneta" ? "Camioneta" : "SUV / pick up"}</p>
                    <p className="num mt-1 text-xl font-bold text-gold">${s.detail[v].toLocaleString("es-MX")}</p>
                  </div>
                ))}
              </div>
              <div className="relative mt-5"><SingleWashButton service="detallado" className="btn-gold min-h-16 w-full text-lg" label="Reservar detallado" /></div>
            </article>

            {/* Lavado profundo: intermedio */}
            <article className="rounded-[28px] border border-white/15 bg-white/[.04] p-6">
              <h3 className="text-xl font-semibold text-white">Lavado profundo</h3>
              <p className="mt-1 text-base text-white/60">Por dentro y por fuera, a detalle.</p>
              <ul className="mt-4 grid gap-2 text-base text-white/80">
                {["Lavado exterior a detalle", "Aspirado profundo de asientos, tapetes y cajuela", "Limpieza de tablero, puertas y vidrios"].map((t) => (
                  <li key={t} className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-white/50" aria-hidden />{t}</li>
                ))}
              </ul>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {(["carro", "camioneta", "suv"] as const).map((v) => (
                  <div key={v} className="rounded-2xl bg-white/[.05] px-3 py-3">
                    <p className="text-[13px] leading-tight text-white/60">{v === "carro" ? "Carro" : v === "camioneta" ? "Camioneta" : "SUV / pick up"}</p>
                    <p className="num mt-1 text-xl font-bold text-white">${s.deep[v]}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5"><SingleWashButton service="profundo" label="Reservar profundo" /></div>
            </article>

            {/* Lavado sencillo: el básico */}
            <article className="rounded-[28px] border border-white/10 bg-white/[.02] p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Lavado sencillo</h3>
                <p className="num text-base text-white/70">desde ${s.single.carro}</p>
              </div>
              <p className="mt-1 text-sm text-white/60">Exterior y aspirado de interior.</p>
              <p className="num mt-3 text-sm text-white/55">Carro ${s.single.carro} · Camioneta ${s.single.camioneta} · SUV / pick up ${s.single.suv}</p>
              <div className="mt-4"><SingleWashButton service="sencillo" className="btn-line min-h-12 w-full text-base" label="Reservar sencillo" /></div>
            </article>
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

      <ReserveSheet hours={s.hours} prices={{ sencillo: s.single, profundo: s.deep, detallado: s.detail }} mpPublicKey={mpKey} />
    </>
  );
}
