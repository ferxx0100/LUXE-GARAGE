import { sameOrigin } from "@/lib/auth";
import { json } from "@/lib/http";
import { cancelWash, memberFromRequest } from "@/lib/members";
import { z } from "zod";

export const dynamic = "force-dynamic";
const Body = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{22}$/) });

// Cancelar una lavada: solo con más de 72 h. La lavada regresa a su mes.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Origen no permitido" }, 403);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Lavada no válida." }, 400);
  try {
    const m = await memberFromRequest(req);
    if (!m) return json({ error: "Entra con tu celular y NIP." }, 401);
    const r = await cancelWash(m, parsed.data.id);
    return r.ok ? json({ ok: true }) : json({ error: r.error }, r.status);
  } catch {
    return json({ error: "No pudimos cancelar. Intenta de nuevo." }, 503);
  }
}
