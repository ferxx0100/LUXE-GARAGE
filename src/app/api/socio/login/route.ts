import { sameOrigin } from "@/lib/auth";
import { clientIp, json } from "@/lib/http";
import { login, memberCookie } from "@/lib/members";
import { z } from "zod";

export const dynamic = "force-dynamic";
const Body = z.object({ phone: z.string().max(25), nip: z.string().max(8) });

// Entrar: celular + NIP. Bloqueo de 15 min después de 5 intentos fallidos por celular.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Origen no permitido" }, 403);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Escribe tu celular y tu NIP." }, 400);
  try {
    const r = await login(parsed.data.phone, parsed.data.nip.trim(), clientIp(req));
    if (!r.ok) return json({ error: r.error }, r.status);
    return json({ ok: true }, 200, { "Set-Cookie": memberCookie(r.value) });
  } catch {
    return json({ error: "No pudimos entrar. Intenta de nuevo." }, 503);
  }
}
