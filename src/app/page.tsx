import GarageHero from "@/components/GarageHero";
import { BUSINESS, whatsappLink } from "@/lib/config";
import { getSettings, hoursLabel } from "@/lib/settings";

// Página estática regenerada al guardar en /admin (y cada 5 min por si acaso).
export const revalidate = 300;

const Section = ({ id, title, kicker, children }: { id: string; title: string; kicker: string; children: React.ReactNode }) => (
  <section id={id} className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20">
    <p className="text-xs tracking-[.4em] text-gold/80">{kicker}</p>
    <h2 className="font-display mt-2 text-3xl font-bold sm:text-4xl">{title}</h2>
    <div className="mt-8">{children}</div>
  </section>
);

const Card = ({ children, hot }: { children: React.ReactNode; hot?: boolean }) => (
  <div className={`rounded-2xl border p-6 ${hot ? "border-gold bg-gold/5" : "border-white/10 bg-white/[.03]"}`}>{children}</div>
);

export default async function Home() {
  const s = await getSettings();
  const horario = hoursLabel(s.hours);
  return (
    <main>
      <GarageHero notice={s.notice} hours={horario} />

      <Section id="como" kicker="CÓMO FUNCIONA" title="Llegas cuando está libre">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><h3 className="font-semibold text-gold">1. Mira el garage</h3><p className="mt-2 text-white/70">Verde: libre, ven ya. Rojo: hay un auto adentro. Se actualiza en vivo.</p></Card>
          <Card><h3 className="font-semibold text-gold">2. Elige cómo</h3><p className="mt-2 text-white/70">Llévalo tú o vamos por él a domicilio. Exterior: no necesitas bajarte del auto. Interior: déjalo cuando el garage esté libre.</p></Card>
          <Card><h3 className="font-semibold text-gold">3. Sin sorpresas</h3><p className="mt-2 text-white/70">Si está libre, está libre. Solo las reservas pagadas apartan un horario.</p></Card>
        </div>
      </Section>

      <Section id="reservar" kicker="RESERVA" title="Aparta tu horario">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card><p className="text-white/60">Lavado normal · Carro</p><p className="font-display mt-1 text-4xl text-gold">${s.prices.carro}</p></Card>
          <Card><p className="text-white/60">Lavado normal · Camioneta</p><p className="font-display mt-1 text-4xl text-gold">${s.prices.camioneta}</p></Card>
        </div>
        <p className="mt-4 text-white/60">A domicilio: +${s.prices.domicilio} por cada ida.</p>
        <p className="mt-6 rounded-xl border border-dashed border-gold/40 p-4 text-sm text-white/60">
          Calendario y pago en línea: en construcción (siguiente fase). Mientras tanto,{" "}
          <a className="text-gold underline" href={whatsappLink("Hola, quiero reservar un lavado en LUXE GARAGE")}>reserva por WhatsApp</a>.
        </p>
      </Section>

      <Section id="suscripcion" kicker="SUSCRIPCIÓN MENSUAL" title={`${s.subscriptionWashes} lavadas al mes`}>
        <Card hot>
          <p className="font-display text-gold-grad text-6xl font-bold">${s.prices.suscripcion}<span className="text-lg text-white/60"> /mes</span></p>
          <ul className="mt-6 space-y-2 text-white/80">
            <li>• Eliges tus {s.subscriptionWashes} días del mes.</li>
            <li>• No necesitas reservar hora: si el garage está libre, pasas.</li>
            <li>• Exterior sin bajarte del auto. Interior: déjalo cuando esté libre.</li>
            <li>• ¿Prefieres domicilio? +${s.prices.domicilio} por cada ida.</li>
          </ul>
          <a className="mt-6 inline-block rounded-full bg-gold px-7 py-3 font-semibold text-black hover:bg-gold-hi"
            href={whatsappLink("Hola, quiero la suscripción mensual de LUXE GARAGE")}>Quiero suscribirme</a>
        </Card>
      </Section>

      <Section id="lugar" kicker="EL LUGAR" title="Así trabajamos">
        <video className="mx-auto aspect-[9/16] max-h-[70vh] rounded-2xl border border-white/10" src="/media/luxe-loop.mp4"
          poster="/media/luxe-poster.jpg" autoPlay muted loop playsInline preload="metadata" />
      </Section>

      <footer className="border-t border-white/10 px-4 py-10 text-center text-sm text-white/50">
        <p className="font-display text-gold">{BUSINESS.name}</p>
        <p className="mt-1">{BUSINESS.location}</p>
        <p className="mt-1">Horario: {horario}</p>
        <p className="mt-1">© {new Date().getFullYear()} {BUSINESS.name}. Todos los derechos reservados.</p>
      </footer>
    </main>
  );
}
