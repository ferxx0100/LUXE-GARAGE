import { sameOrigin } from "@/lib/auth";
import { BookingInput, createHold } from "@/lib/bookings";
import { mpConfigured } from "@/lib/payments/mercadopago";
import { kvIncr } from "@/lib/store";

export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: { "Cache-Control": "no-store" } });

// Aparta la hora (celdas de 10 min) por 15 min mientras el cliente paga. Solo pedimos nombre y teléfono.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Origen no permitido" }, 403);
  if (!mpConfigured()) return json({ error: "Los pagos en línea se están activando. Intenta más tarde." }, 503);
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  try {
    if ((await kvIncr(`lg:rl:book:${ip}`, 3600)) > 12) return json({ error: "Demasiados intentos. Espera un rato." }, 429);
    const parsed = BookingInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Revisa tus datos" }, 400);
    const r = await createHold(parsed.data);
    if (!r.ok) return json({ error: r.error }, r.status);
    const b = r.value;
    return json({ id: b.id, code: b.code, amount: b.amount, duration: b.duration });
  } catch {
    return json({ error: "No pudimos apartar el horario. Intenta de nuevo." }, 503);
  }
}
