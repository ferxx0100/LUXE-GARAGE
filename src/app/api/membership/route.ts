import { sameOrigin } from "@/lib/auth";
import { createMembershipHold, MembershipInput } from "@/lib/memberships";
import { mpConfigured } from "@/lib/payments/mercadopago";
import { kvIncr } from "@/lib/store";

export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: { "Cache-Control": "no-store" } });

// Membresía: aparta las 4 lavadas elegidas (todas o ninguna) por 15 min mientras el cliente paga.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Origen no permitido" }, 403);
  if (!mpConfigured()) return json({ error: "Los pagos en línea se están activando. Intenta más tarde." }, 503);
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  try {
    if ((await kvIncr(`lg:rl:mb:${ip}`, 3600)) > 12) return json({ error: "Demasiados intentos. Espera un rato." }, 429);
    const parsed = MembershipInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Revisa tus datos" }, 400);
    const r = await createMembershipHold(parsed.data);
    if (!r.ok) return json({ error: r.error }, r.status);
    const m = r.value;
    return json({ id: m.id, code: m.code, amount: m.amount, washes: m.washes, validTo: m.validTo });
  } catch {
    return json({ error: "No pudimos apartar tus lavadas. Intenta de nuevo." }, 503);
  }
}
