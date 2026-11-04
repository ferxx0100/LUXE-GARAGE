import { sameOrigin } from "@/lib/auth";
import { confirmBooking, getBooking, holdStillValid, markPending, setEmail } from "@/lib/bookings";
import { CardFormSchema, chargeCard, MpError, mpReason, rejectMessage, type CardForm } from "@/lib/payments/mercadopago";

export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ error: "Origen no permitido" }, 403);
  const { id } = await params;
  const form = CardFormSchema.safeParse(await req.json().catch(() => null));
  if (!form.success) return json({ error: "Datos de pago incompletos" }, 400);
  try {
    const b = await getBooking(id);
    if (!b) return json({ error: "Reserva no encontrada" }, 404);
    if (b.status === "confirmed" || b.status === "done") return json({ status: "approved", id });
    if (b.status !== "hold" || !(await holdStillValid(b))) return json({ error: "Tu apartado expiró. Elige la hora de nuevo." }, 409);

    const email = form.data.payer?.email?.trim().toLowerCase() || b.email;
    if (!email) return json({ error: "Escribe tu correo en el formulario de pago" }, 400);
    if (email !== b.email) await setEmail(id, email); // para mandarle su confirmación
    // El monto sale de la reserva guardada (calculado por el servidor), nunca del navegador.
    const description = `LUXE GARAGE ${b.code} · ${b.date} ${b.time}${b.plate ? ` · Placas ${b.plate}` : ""}`;
    const pay = await chargeCard({ id: b.id, code: b.code, amount: b.amount, email, description }, form.data as CardForm);
    const pid = String(pay.id);
    if (pay.status === "approved") {
      const done = await confirmBooking(id, pid);
      return json({ status: done?.status === "conflict" ? "conflict" : "approved", id });
    }
    if (pay.status === "in_process" || pay.status === "pending") {
      await markPending(id, pid, pay.status);
      return json({ status: "pending", id });
    }
    return json({ status: "rejected", id, error: rejectMessage(pay.status_detail) }, 402);
  } catch (e) {
    // Sin datos personales en el log.
    console.error("pago falló:", mpReason(e));
    return json({ error: "No pudimos procesar el pago. No se hizo ningún cargo; intenta de nuevo." }, 502);
  }
}
