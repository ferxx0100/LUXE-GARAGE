import { adminConfigured, checkPassword, deny, recordFail, sameOrigin, sessionCookie, tooManyAttempts } from "@/lib/auth";
import { z } from "zod";

const Body = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return deny.origin();
  if (!adminConfigured()) return deny.bad("Falta conectar Upstash en Vercel");
  try {
    if (await tooManyAttempts(req)) return Response.json({ error: "Demasiados intentos, espera 15 minutos" }, { status: 429 });
  } catch {
    return deny.down();
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const role = parsed.success ? checkPassword(parsed.data.password) : null;
  if (!role) {
    await recordFail(req).catch(() => {});
    return Response.json({ error: "Contraseña incorrecta" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ ok: true, role }, { headers: { "Set-Cookie": sessionCookie(role), "Cache-Control": "no-store" } });
}
