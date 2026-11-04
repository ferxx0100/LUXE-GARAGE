import { sameOrigin } from "@/lib/auth";
import { json } from "@/lib/http";
import { bookWash, memberFromRequest } from "@/lib/members";
import { z } from "zod";

export const dynamic = "force-dynamic";
const Body = z.union([
  z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/) }),
  z.object({ now: z.literal(true) }),
]);

// El socio aparta una lavada (o "Estoy aquí: lavar ahora"). Sin pago: descuenta de sus lavadas del mes.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Origen no permitido" }, 403);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Elige día y hora." }, 400);
  try {
    const m = await memberFromRequest(req);
    if (!m) return json({ error: "Entra con tu celular y NIP." }, 401);
    const r = "now" in parsed.data ? await bookWash(m, "", "", true) : await bookWash(m, parsed.data.date, parsed.data.time);
    if (!r.ok) return json({ error: r.error }, r.status);
    return json({ id: r.value.id, date: r.value.date, time: r.value.time });
  } catch {
    return json({ error: "No pudimos apartar. Intenta de nuevo." }, 503);
  }
}
