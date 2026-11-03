import { verifyMpSignature } from "@/lib/booking-core";
import { confirmBooking, getBooking, markPending } from "@/lib/bookings";
import { confirmMembership, getMembership, markMembershipPending } from "@/lib/memberships";
import { getPayment } from "@/lib/payments/mercadopago";
import { redis } from "@/lib/store";

export const dynamic = "force-dynamic";

// Aviso de Mercado Pago. Reglas: firma válida, consultar el pago a la API (no confiar en el aviso),
// verificar monto y referencia (reserva o membresía), y procesar una sola vez por pago.
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
    const m = b ? null : await getMembership(ref);
    const target = b ?? m;
    if (!target) return new Response(null, { status: 200 });
    const code = target.code;
    if (pay.status === "approved") {
      if (Number(pay.transaction_amount) !== target.amount) { console.error("webhook: monto no coincide", code); return new Response(null, { status: 200 }); }
      const first = (await redis("SET", `lg:paid:${dataId}`, target.id, "NX", "EX", 30 * 24 * 3600)) === "OK";
      if (first || target.status !== "confirmed") await (b ? confirmBooking(target.id, dataId) : confirmMembership(target.id, dataId));
    } else if (pay.status === "in_process" || pay.status === "pending") {
      await (b ? markPending(target.id, dataId, pay.status) : markMembershipPending(target.id, dataId, pay.status));
    }
    return new Response(null, { status: 200 });
  } catch {
    console.error("webhook: error al consultar el pago");
    return new Response(null, { status: 500 }); // Mercado Pago reintenta
  }
}
