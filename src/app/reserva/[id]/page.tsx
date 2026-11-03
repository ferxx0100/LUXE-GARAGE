import { getBooking } from "@/lib/bookings";
import { BUSINESS, mapsLink, telLink } from "@/lib/config";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu reserva | LUXE GARAGE", robots: { index: false, follow: false } };

const DAY = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTH = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fmt = (d: string) => { const x = new Date(`${d}T12:00:00Z`); return `${DAY[x.getUTCDay()]} ${x.getUTCDate()} de ${MONTH[x.getUTCMonth()]}`; };

// El comprobante que recibe el cliente. El enlace es secreto (id aleatorio de 128 bits).
export default async function Reserva({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBooking(id).catch(() => null);
  if (!b) notFound();

  const state = {
    confirmed: { t: "¡Reserva confirmada!", c: "text-go", s: "Te esperamos. Guarda esta página o agrégala a tu calendario." },
    done: { t: "Servicio completado", c: "text-gold", s: "Gracias por tu visita." },
    pending: { t: "Pago en revisión", c: "text-amber-300", s: "Mercado Pago está revisando tu pago. Esta página se actualiza sola." },
    hold: { t: "Pago pendiente", c: "text-amber-300", s: "Tu horario estuvo apartado 15 minutos. Si no pagaste, vuelve a reservar." },
    cancelled: { t: "Reserva cancelada", c: "text-zinc-300", s: "Si tienes dudas, toca Ayuda." },
    conflict: { t: "Pago recibido", c: "text-amber-300", s: "Tu pago llegó, pero ese horario se ocupó. Te contactamos para reagendar o devolverte el dinero." },
  }[b.status];

  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-10">
      {b.status === "pending" && <meta httpEquiv="refresh" content="20" />}
      <a href="/" className="font-display text-sm tracking-[.25em] text-gold">← LUXE GARAGE</a>
      <h1 className={`font-display mt-6 text-4xl font-semibold leading-tight ${state.c}`}>{state.t}</h1>
      <p className="mt-3 text-lg text-white/85">{state.s}</p>

      <section className="mt-8 overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-b from-gold/[.10] to-transparent">
        <div className="flex items-center justify-between border-b border-dashed border-gold/30 px-6 py-5">
          <div>
            <p className="text-xs font-semibold tracking-[.3em] text-white/60">CÓDIGO</p>
            <p className="font-display text-3xl font-semibold tracking-wider text-gold">{b.code}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/emblem-128.png" alt="" width="56" height="56" />
        </div>
        <dl className="grid gap-4 px-6 py-6 text-lg">
          <div><dt className="text-sm text-white/60">Cuándo</dt><dd className="font-bold capitalize">{fmt(b.date)} · {b.time} h</dd></div>
          <div><dt className="text-sm text-white/60">Servicio</dt><dd className="font-bold">Lavado {b.kind} · {b.vehicle === "carro" ? "Carro" : "Camioneta"}{b.plate ? ` · ${b.plate}` : ""}</dd></div>
          <div><dt className="text-sm text-white/60">Dónde</dt><dd className="font-bold">{b.place === "domicilio" ? `A domicilio: ${b.address}` : BUSINESS.location}</dd></div>
          <div><dt className="text-sm text-white/60">A nombre de</dt><dd className="font-bold">{b.name}</dd></div>
          <div className="flex items-end justify-between border-t border-white/10 pt-4">
            <div><dt className="text-sm text-white/60">Total pagado</dt><dd className="font-display text-gold-grad text-4xl font-semibold">${b.amount}</dd></div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm">{b.paymentStatus === "approved" ? "Pagado" : b.status === "cancelled" ? "Cancelada" : "Por confirmar"}</span>
          </div>
        </dl>
      </section>

      <div className="mt-6 grid gap-3">
        {["confirmed", "pending"].includes(b.status) && <a href={`/api/booking/${b.id}/ics`} className="btn-gold text-lg">Agregar a mi calendario</a>}
        {b.place === "garage" && <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="btn-line text-lg">Cómo llegar</a>}
        <a href={telLink} className="btn-line text-lg">¿Dudas? Llámanos</a>
      </div>
      <p className="mt-6 text-center text-sm text-white/55">Te llegó el recibo de Mercado Pago a {b.email.replace(/^(.).*(@.*)$/, "$1***$2")}. Muestra este código al llegar.</p>
    </main>
  );
}
