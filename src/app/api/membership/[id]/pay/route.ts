import { sameOrigin } from "@/lib/auth";
import { confirmMembership, getMembership, markMembershipPending, membershipHoldValid, setMembershipEmail } from "@/lib/memberships";
import { CardFormSchema, chargeCard, MpError, rejectMessage, type CardForm } from "@/lib/payments/mercadopago";

export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ error: "Origen no permitido" }, 403);
  const { id } = await params;
  const form = CardFormSchema.safeParse(await req.json().catch(() => null));
  if (!form.success) return json({ error: "Datos de pago incompletos" }, 400);
  try {
    const m = await getMembership(id);
    if (!m) return json({ error: "Membresía no encontrada" }, 404);
    if (m.status === "confirmed") return json({ status: "approved", id });
    if (m.status !== "hold" || !(await membershipHoldValid(m))) return json({ error: "Tu apartado expiró. Elige tus lavadas de nuevo." }, 409);

    const email = form.data.payer?.email?.trim().toLowerCase() || m.email;
    if (!email) return json({ error: "Escribe tu correo en el formulario de pago" }, 400);
    if (email !== m.email) await setMembershipEmail(id, email);
    // Precio de la membresía guardado al apartar (settings.prices.suscripcion), nunca el del navegador.
    const description = `LUXE GARAGE ${m.code} · Membresía ${m.washes.length} lavadas${m.plate ? ` · Placas ${m.plate}` : ""}`;
    const pay = await chargeCard({ id: m.id, code: m.code, amount: m.amount, email, description }, form.data as CardForm);
    const pid = String(pay.id);
    if (pay.status === "approved") {
      const done = await confirmMembership(id, pid);
      return json({ status: done?.status === "conflict" ? "conflict" : "approved", id });
    }
    if (pay.status === "in_process" || pay.status === "pending") {
      await markMembershipPending(id, pid, pay.status);
      return json({ status: "pending", id });
    }
    return json({ status: "rejected", id, error: rejectMessage(pay.status_detail) }, 402);
  } catch (e) {
    console.error("pago membresía:", e instanceof MpError ? `MP ${e.status}` : "error");
    return json({ error: "No pudimos procesar el pago. No se hizo ningún cargo; intenta de nuevo." }, 502);
  }
}
