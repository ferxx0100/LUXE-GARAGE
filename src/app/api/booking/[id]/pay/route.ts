import { sameOrigin } from "@/lib/auth";
import { confirmBooking, getBooking, holdStillValid, markPending } from "@/lib/bookings";
import { chargeCard, MpError, rejectMessage, type CardForm } from "@/lib/payments/mercadopago";
import { z } from "zod";

export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: { "Cache-Control": "no-store" } });

const Form = z.object({
  token: z.string().min(8).max(200),
  payment_method_id: z.string().min(2).max(40),
  issuer_id: z.union([z.string(), z.number()]).optional(),
  installments: z.number().int().optional(),
  payer: z.object({ email: z.string().email().optional(), identification: z.object({ type: z.string().optional(), number: z.string().optional() }).optional() }).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ error: "Origen no permitido" }, 403);
  const { id } = await params;
  const form = Form.safeParse(await req.json().catch(() => null));
  if (!form.success) return json({ error: "Datos de pago incompletos" }, 400);
  try {
    const b = await getBooking(id);
    if (!b) return json({ error: "Reserva no encontrada" }, 404);
    if (b.status === "confirmed" || b.status === "done") return json({ status: "approved", id });
    if (b.status !== "hold" || !(await holdStillValid(b))) return json({ error: "Tu apartado expiró. Elige el horario de nuevo." }, 409);

    const pay = await chargeCard(b, form.data as CardForm);
    const pid = String(pay.id);
    if (pay.status === "approved") {
      const done = await confirmBooking(id, pid);
      return json({ status: done?.status === "conflict" ? "conflict" : "approved", id });
    }
    if (pay.status === "in_process" || pay.status === "pending") {
      await markPending(id, pid, pay.status);
      return json({ status: "pending", id });
    }
    return json({ status: "rejected", error: rejectMessage(pay.status_detail) }, 402);
  } catch (e) {
    // Sin datos personales en el log.
    console.error("pago:", e instanceof MpError ? `MP ${e.status}` : "error");
    return json({ error: "No pudimos procesar el pago. No se hizo ningún cargo; intenta de nuevo." }, 502);
  }
}
