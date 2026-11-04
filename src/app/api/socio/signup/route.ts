import { sameOrigin } from "@/lib/auth";
import { clientIp, json } from "@/lib/http";
import { SignupInput, startSignup } from "@/lib/members";
import { mpConfigured } from "@/lib/payments/mercadopago";
import { kvIncr } from "@/lib/store";

export const dynamic = "force-dynamic";

// Hazte socio, paso 1: vehículo, nombre, celular y NIP. Todavía no se cobra (eso es /subscribe).
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Origen no permitido" }, 403);
  if (!mpConfigured()) return json({ error: "Los pagos en línea se están activando. Intenta más tarde." }, 503);
  try {
    if ((await kvIncr(`lg:rl:signup:${clientIp(req)}`, 3600)) > 10) return json({ error: "Demasiados intentos. Espera un rato." }, 429);
    const parsed = SignupInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Revisa tus datos" }, 400);
    const r = await startSignup(parsed.data);
    if (!r.ok) return json({ error: r.error }, r.status);
    return json({ id: r.value.id, amount: r.value.price, vehicle: r.value.vehicle });
  } catch {
    return json({ error: "No pudimos guardar tus datos. Intenta de nuevo." }, 503);
  }
}
