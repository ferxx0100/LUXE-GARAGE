import { fmtDay, fmtRange, maskPhone } from "@/lib/booking-core";
import { durationOf, getBooking, liveSeal } from "@/lib/bookings";
import { BUSINESS, mapsLink, telLink, whatsappLink } from "@/lib/config";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReceiptSeal from "./ReceiptSeal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu reserva | LUXE GARAGE", robots: { index: false, follow: false } };

// El comprobante que recibe el cliente. El enlace es secreto (id aleatorio de 128 bits).
export default async function Reserva({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBooking(id).catch(() => null);
  if (!b) notFound();

  const state = {
    confirmed: { t: "¡Reserva confirmada!", c: "text-go", s: "Te esperamos. Muestra esta pantalla al llegar." },
    done: { t: "Servicio completado", c: "text-gold", s: "Gracias por tu visita." },
    pending: { t: "Pago en revisión", c: "text-gold", s: "Mercado Pago está revisando tu pago. Esta página se actualiza sola." },
    hold: { t: "Pago pendiente", c: "text-gold", s: "Tu hora estuvo apartada 15 minutos. Si no pagaste, vuelve a reservar." },
    cancelled: { t: "Reserva cancelada", c: "text-white/80", s: "Si tienes dudas, toca Ayuda." },
    conflict: { t: "Pago recibido", c: "text-gold", s: "Tu pago llegó, pero esa hora se ocupó. Te contactamos para reagendar o devolverte el dinero." },
  }[b.status];
  const live = ["confirmed", "pending", "done", "cancelled"].includes(b.status);
  const range = fmtRange(b.time, durationOf(b));

  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-10">
      {b.status === "pending" && <meta httpEquiv="refresh" content="20" />}
      <a href="/" className="font-display text-sm tracking-[.25em] text-gold">← LUXE GARAGE</a>
      <h1 className={`font-display mt-6 text-4xl font-semibold leading-tight ${state.c}`}>{state.t}</h1>
      <p className="mt-3 text-lg text-white/85">{state.s}</p>

      <section className="mt-8 overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-b from-gold/[.10] to-transparent">
        {live && <ReceiptSeal endpoint={`/api/booking/${b.id}/seal`} initial={{ status: b.status, ...liveSeal(b.id) }} />}
        <div className={`flex items-center justify-between border-y border-dashed border-gold/30 px-6 py-5 ${live ? "" : "border-t-0"}`}>
          <div>
            <p className="text-xs font-semibold tracking-[.3em] text-white/60">CÓDIGO</p>
            <p className="font-display text-3xl font-semibold tracking-wider text-gold">{b.code}</p>
          </div>
          {!live && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/brand/emblem-128.png" alt="" width="56" height="56" />
          )}
        </div>
        <dl className="grid gap-4 px-6 py-6 text-lg">
          <div><dt className="text-sm text-white/60">Cuándo</dt><dd className="font-bold"><span className="capitalize">{fmtDay(b.date)}</span><br />{range}</dd></div>
          <div><dt className="text-sm text-white/60">Servicio</dt><dd className="font-bold">{b.kind === "exterior" ? "Solo exterior" : "Exterior e interior"} · {b.vehicle === "carro" ? "Carro" : "Camioneta"}</dd></div>
          <div><dt className="text-sm text-white/60">Dónde</dt><dd className="font-bold">{b.place === "domicilio" ? `A domicilio: ${b.address}` : BUSINESS.location}</dd></div>
          <div className="grid grid-cols-2 gap-4">
            <div><dt className="text-sm text-white/60">A nombre de</dt><dd className="font-bold">{b.name}</dd></div>
            <div><dt className="text-sm text-white/60">Teléfono</dt><dd className="font-bold tabular-nums">{maskPhone(b.phone)}</dd></div>
          </div>
          <div className="flex items-end justify-between border-t border-white/10 pt-4">
            <div><dt className="text-sm text-white/60">{b.membershipCode ? "Membresía" : "Total pagado"}</dt><dd className="font-display text-gold-grad text-4xl font-semibold">{b.membershipCode ?? `$${b.amount}`}</dd></div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm">{b.status === "cancelled" ? "Cancelada" : b.status === "done" ? "Usada" : b.paymentStatus === "approved" ? "Pagado" : "Por confirmar"}</span>
          </div>
        </dl>
      </section>

      <div className="mt-6 grid gap-3">
        {["confirmed", "pending"].includes(b.status) && <a href={`/api/booking/${b.id}/ics`} className="btn-gold min-h-14 text-lg">Agregar a mi calendario</a>}
        {b.place === "garage" && b.status !== "cancelled" && <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="btn-line min-h-14 text-lg">Cómo llegar</a>}
        {["confirmed", "pending", "conflict"].includes(b.status) && (
          <a href={whatsappLink(`Hola, quiero cambiar o cancelar mi reserva ${b.code} (${fmtDay(b.date)}, ${range}).`)} target="_blank" rel="noopener noreferrer" className="btn-line min-h-14 text-lg">Cambiar o cancelar</a>
        )}
        <a href={telLink} className="btn-line min-h-14 text-lg">¿Dudas? Llámanos</a>
      </div>
      {b.email && <p className="mt-6 text-center text-sm text-white/55">Te llegó el recibo de Mercado Pago a {b.email.replace(/^(.).*(@.*)$/, "$1***$2")}.</p>}
    </main>
  );
}
