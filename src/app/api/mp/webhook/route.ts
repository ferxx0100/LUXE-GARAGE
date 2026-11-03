import { verifyMpSignature } from "@/lib/booking-core";
import { confirmBooking, getBooking, markPending } from "@/lib/bookings";
import { getPayment } from "@/lib/payments/mercadopago";
import { redis } from "@/lib/store";

export const dynamic = "force-dynamic";

// Aviso de Mercado Pago. Reglas: firma válida, consultar el pago a la API (no confiar en el aviso),
// verificar monto y referencia, y procesar una sola vez por pago.
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
    const pay = await getPayment(dataId);
    const ref = pay.external_reference ?? "";
    const b = await getBooking(ref);
    if (!b) return new Response(null, { status: 200 });
    if (pay.status === "approved") {
      if (Number(pay.transaction_amount) !== b.amount) { console.error("webhook: monto no coincide", b.code); return new Response(null, { status: 200 }); }
      if ((await redis("SET", `lg:paid:${dataId}`, b.id, "NX", "EX", 30 * 24 * 3600)) === "OK" || b.status !== "confirmed") await confirmBooking(b.id, dataId);
    } else if (pay.status === "in_process" || pay.status === "pending") {
      await markPending(b.id, dataId, pay.status);
    }
    return new Response(null, { status: 200 });
  } catch {
    console.error("webhook: error al consultar el pago");
    return new Response(null, { status: 500 }); // Mercado Pago reintenta
  }
}
