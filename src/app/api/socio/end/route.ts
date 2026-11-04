import { sameOrigin } from "@/lib/auth";
import { json } from "@/lib/http";
import { cancelSubscription, memberFromRequest } from "@/lib/members";
import { mpReason } from "@/lib/payments/mercadopago";

export const dynamic = "force-dynamic";

// Cancelar la membresía: Mercado Pago deja de cobrar. Lo ya pagado se puede usar hasta que termine su mes.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Origen no permitido" }, 403);
  try {
    const m = await memberFromRequest(req);
    if (!m) return json({ error: "Entra con tu celular y NIP." }, 401);
    const next = await cancelSubscription(m);
    return json({ status: next.status, periodEnd: next.periodEnd ?? null });
  } catch (e) {
    console.error("cancelar membresía falló:", mpReason(e));
    return json({ error: "No pudimos cancelar. Intenta de nuevo o toca Ayuda." }, 502);
  }
}
