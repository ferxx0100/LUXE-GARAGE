import { fmtDay, fmtRange, maskPhone } from "@/lib/booking-core";
import { liveSeal } from "@/lib/bookings";
import { BUSINESS, mapsLink, telLink } from "@/lib/config";
import { getMembership, membershipBookings } from "@/lib/memberships";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReceiptSeal from "../../reserva/[id]/ReceiptSeal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu membresía | LUXE GARAGE", robots: { index: false, follow: false } };

const btnCyan = "inline-flex min-h-14 items-center justify-center rounded-full bg-[#22d3ee] px-6 text-lg font-bold text-[#031b2e] active:scale-[.97]";
const btnLine = "inline-flex min-h-14 items-center justify-center rounded-full border border-[#22d3ee]/60 px-6 text-lg font-bold text-[#22d3ee] active:scale-[.97]";

// Comprobante de la membresía (enlace secreto). Tema agua: cian sobre azul profundo.
export default async function Membresia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMembership(id).catch(() => null);
  if (!m) notFound();

  const booked = m.status === "confirmed" ? await membershipBookings(m).catch(() => []) : [];
  const byDate = new Map(booked.map((b) => [b.date, b]));
  const washes = m.washes.map((w) => ({ ...w, status: byDate.get(w.date)?.status ?? m.status }));
  const used = washes.filter((w) => w.status === "done").length;
  const allUsed = m.status === "confirmed" && used === washes.length;
  const live = m.status === "confirmed" || m.status === "pending" || m.status === "cancelled";

  const state = {
    confirmed: { t: allUsed ? "Membresía completada" : "¡Membresía activa!", s: allUsed ? "Ya usaste tus lavadas. ¡Gracias!" : "Muestra esta pantalla en cada visita." },
    pending: { t: "Pago en revisión", s: "Mercado Pago está revisando tu pago. Esta página se actualiza sola." },
    hold: { t: "Pago pendiente", s: "Tus lavadas estuvieron apartadas 15 minutos. Si no pagaste, vuelve a elegirlas." },
    cancelled: { t: "Membresía cancelada", s: "Si tienes dudas, llámanos." },
    conflict: { t: "Pago recibido", s: "Tu pago llegó, pero una de tus horas se ocupó. Te contactamos para reagendar o devolverte el dinero." },
  }[m.status];

  return (
    <div className="min-h-screen bg-[#031b2e] bg-[radial-gradient(120%_60%_at_50%_0%,rgba(34,211,238,.16),transparent_70%)]">
      <main className="mx-auto max-w-md px-5 pb-16 pt-10 text-white">
        {m.status === "pending" && <meta httpEquiv="refresh" content="20" />}
        <a href="/" className="font-display text-sm tracking-[.25em] text-[#22d3ee]">← LUXE GARAGE</a>
        <h1 className="font-display mt-6 text-4xl font-semibold leading-tight text-[#22d3ee]">{state.t}</h1>
        <p className="mt-3 text-lg text-white/85">{state.s}</p>

        <section className="mt-8 overflow-hidden rounded-3xl border border-[#22d3ee]/40 bg-gradient-to-b from-[#22d3ee]/[.10] to-transparent">
          {live && <ReceiptSeal tone="cyan" endpoint={`/api/membership/${m.id}/seal`} initial={{ status: allUsed ? "done" : m.status, ...liveSeal(m.id) }} />}
          <div className="border-y border-dashed border-[#22d3ee]/30 px-6 py-5">
            <p className="text-xs font-semibold tracking-[.3em] text-white/60">MEMBRESÍA</p>
            <p className="font-display text-3xl font-semibold tracking-wider text-[#22d3ee]">{m.code}</p>
          </div>
          <dl className="grid gap-4 px-6 py-6 text-lg">
            <div className="grid grid-cols-2 gap-4">
              <div><dt className="text-sm text-white/60">A nombre de</dt><dd className="font-bold">{m.name}</dd></div>
              <div><dt className="text-sm text-white/60">Teléfono</dt><dd className="font-bold tabular-nums">{maskPhone(m.phone)}</dd></div>
            </div>
            <div><dt className="text-sm text-white/60">Servicio</dt><dd className="font-bold">{m.kind === "exterior" ? "Solo exterior" : "Exterior e interior"} · {m.vehicle === "carro" ? "Carro" : "Camioneta"}{m.plate ? ` · ${m.plate}` : ""}</dd></div>
            <div><dt className="text-sm text-white/60">Vigencia</dt><dd className="font-bold">Hasta el <span>{fmtDay(m.validTo)}</span></dd></div>
          </dl>

          <div className="px-6 pb-6">
            <p className="text-sm text-white/60">Tus {washes.length} lavadas{m.status === "confirmed" ? ` · ${used} de ${washes.length} usadas` : ""}</p>
            <ol className="mt-3 grid gap-2">
              {washes.map((w, i) => {
                const done = w.status === "done", off = w.status === "cancelled";
                return (
                  <li key={w.date} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${done ? "border-white/10 bg-white/[.03] text-white/50" : "border-[#22d3ee]/25 bg-[#22d3ee]/[.06]"}`}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold ${done ? "bg-white/10" : "bg-[#22d3ee] text-[#031b2e]"}`}>{done ? "✓" : i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-bold capitalize ${off ? "line-through" : ""}`}>{fmtDay(w.date)}</span>
                      <span className="block tabular-nums">{fmtRange(w.time, m.duration)}</span>
                    </span>
                    {(done || off) && <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">{done ? "USADA" : "CANCELADA"}</span>}
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="flex items-end justify-between border-t border-white/10 px-6 py-5">
            <div><p className="text-sm text-white/60">Total pagado</p><p className="font-display text-4xl font-semibold text-[#22d3ee]">${m.amount}</p></div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm">{m.paymentStatus === "approved" ? "Pagado" : m.status === "cancelled" ? "Cancelada" : "Por confirmar"}</span>
          </div>
        </section>

        <div className="mt-6 grid gap-3">
          {(m.status === "confirmed" || m.status === "pending") && !allUsed && <a href={`/api/membership/${m.id}/ics`} className={btnCyan}>Agregar a mi calendario</a>}
          <a href={mapsLink} target="_blank" rel="noopener noreferrer" className={btnLine}>Cómo llegar</a>
          <a href={telLink} className={btnLine}>¿Dudas? Llámanos</a>
        </div>
        <p className="mt-6 text-center text-sm text-white/55">{BUSINESS.location}</p>
      </main>
    </div>
  );
}
