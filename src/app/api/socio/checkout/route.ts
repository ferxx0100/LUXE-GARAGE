import { sameOrigin } from "@/lib/auth";
import { json } from "@/lib/http";
import { getMember, memberCookie, memberFromRequest, subscribeLink } from "@/lib/members";
import { mpConfigured, mpReason } from "@/lib/payments/mercadopago";
import { z } from "zod";

export const dynamic = "force-dynamic";
const Body = z.object({ id: z.string().max(40).optional(), email: z.string().trim().toLowerCase().email().max(120) });

// Pagar la membresía en Mercado Pago (alta nueva con el id de /signup, o renovar con la sesión del socio).
// Regresa el link de Mercado Pago y deja la sesión abierta para que al volver vea su cuenta.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Origen no permitido" }, 403);
  if (!mpConfigured()) return json({ error: "Los pagos en línea se están activando. Intenta más tarde." }, 503);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Escribe un correo válido (Mercado Pago te manda ahí tu comprobante)." }, 400);
  try {
    const session = await memberFromRequest(req);
    const byId = parsed.data.id ? await getMember(parsed.data.id) : null;
    const m = session ?? (byId?.status === "pending" ? byId : null);
    if (!m) return json({ error: "Vuelve a empezar tu alta." }, 404);
    const r = await subscribeLink(m, parsed.data.email);
    if (!r.ok) return json({ error: r.error }, r.status);
    return json({ url: r.value.url ?? "/socio" }, 200, { "Set-Cookie": memberCookie(r.value.member) });
  } catch (e) {
    console.error("suscripción (link) falló:", mpReason(e));
    return json({ error: "No pudimos abrir Mercado Pago. Intenta de nuevo en un momento." }, 502);
  }
}
