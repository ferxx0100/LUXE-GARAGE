import { verifyMpSignature } from "@/lib/booking-core";
import { applyPayment } from "@/lib/payments/apply";
import { getPayment } from "@/lib/payments/mercadopago";

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
  if (type !== "payment" || !/^\d+$/.test(dataId)) return new Response(null, { status: 200 });

  try {
    await applyPayment(await getPayment(dataId));
    return new Response(null, { status: 200 });
  } catch {
    console.error("webhook: error al consultar el pago");
    return new Response(null, { status: 500 }); // Mercado Pago reintenta
  }
}
