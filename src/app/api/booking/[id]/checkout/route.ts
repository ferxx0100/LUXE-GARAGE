import { sameOrigin } from "@/lib/auth";
import { isBookingId } from "@/lib/bookings";
import { checkoutLink } from "@/lib/payments/checkout";
import { MpError } from "@/lib/payments/mercadopago";

export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: { "Cache-Control": "no-store" } });

// "Pagar con Mercado Pago": devuelve el link de Checkout Pro del apartado (monto del servidor).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ error: "Origen no permitido" }, 403);
  const { id } = await params;
  if (!isBookingId(id)) return json({ error: "No encontramos tu apartado." }, 404);
  try {
    const r = await checkoutLink("booking", id, req.headers.get("origin") ?? "");
    return r.ok ? json({ url: r.url }) : json({ error: r.error }, r.status);
  } catch (e) {
    console.error("checkout reserva:", e instanceof MpError ? `MP ${e.status}` : "error");
    return json({ error: "No pudimos abrir Mercado Pago. Intenta con tarjeta o de nuevo en un momento." }, 502);
  }
}
