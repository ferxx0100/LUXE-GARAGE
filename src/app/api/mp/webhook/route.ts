import { verifyMpSignature } from "@/lib/booking-core";
import { applyPayment } from "@/lib/payments/apply";
import { onAuthorizedPayment, onPreapproval } from "@/lib/members";
import { getAuthorizedPayment, getPayment, getPreapproval } from "@/lib/payments/mercadopago";

export const dynamic = "force-dynamic";

// Aviso de Mercado Pago. Reglas: firma válida, consultar el pago a la API (no confiar en el aviso),
// verificar monto y referencia (reserva o membresía), y procesar una sola vez por pago (applyPayment).
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } };
  const dataId = url.searchParams.get("data.id") ?? String(body.data?.id ?? "");
  const type = url.searchParams.get("type") ?? body.type;
  const secret = process.env.MP_WEBHOOK_SECRET ?? "";
  if (!secret) return new Response(null, { status: 503 });
  if (!verifyMpSignature(req.headers.get("x-signature"), req.headers.get("x-request-id"), dataId, secret)) return new Response(null, { status: 401 });
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(dataId)) return new Response(null, { status: 200 });

  try {
    // Lavada suelta (pago) · suscripción de socio (cambió) · cobro mensual del socio. Siempre se consulta a la API.
    if (type === "payment" && /^\d+$/.test(dataId)) await applyPayment(await getPayment(dataId));
    else if (type === "subscription_preapproval") await onPreapproval(await getPreapproval(dataId));
    else if (type === "subscription_authorized_payment") await onAuthorizedPayment(await getAuthorizedPayment(dataId));
    return new Response(null, { status: 200 });
  } catch {
    console.error("webhook: error al consultar el pago");
    return new Response(null, { status: 500 }); // Mercado Pago reintenta
  }
}
