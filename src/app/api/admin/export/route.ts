import { deny, guardActor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { addDays } from "@/lib/booking-core";
import { listBookings } from "@/lib/bookings";

export const dynamic = "force-dynamic";

const ESTADO: Record<string, string> = { confirmed: "Confirmada", pending: "Pago en revisión", done: "Lavada hecha", cancelled: "Cancelada", hold: "Apartando", conflict: "Revisar", expired: "Vencida" };
const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

// Exportar reservas de un mes a CSV (abre en Excel). Solo el dueño; queda en el historial.
export async function GET(req: Request) {
  const g = await guardActor(req, false);
  if ("blocked" in g) return g.blocked;
  const month = new URL(req.url).searchParams.get("mes") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return deny.bad("Mes inválido");
  try {
    const days: string[] = [];
    for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) days.push(d);
    const list = (await listBookings(days)).filter((b) => b.status !== "hold")
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const head = ["Fecha", "Hora", "Código", "Cliente", "Celular", "Correo", "Tipo", "Vehículo", "Monto MXN", "Estado", "Pago Mercado Pago", "Sellada por", "Sellada a las"];
    const rows = list.map((b) => [b.date, b.time, b.code, b.name, b.phone, b.email, b.membershipId ? "Socio" : "Lavada normal", b.vehicle ?? "", b.amount,
      ESTADO[b.status] ?? b.status, b.paymentId ?? "", b.doneBy ?? "", b.doneAt ? new Date(b.doneAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City" }) : ""]);
    const csv = "\ufeff" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
    await audit(g.actor.name, "Exportó reservas", month);
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="reservas-${month}.csv"`, "Cache-Control": "no-store" } });
  } catch {
    return deny.down();
  }
}
