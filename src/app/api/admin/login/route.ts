import { adminConfigured, checkPassword, deny, sameOrigin, sessionCookie, tooManyAttempts } from "@/lib/auth";
import { z } from "zod";

const Body = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return deny.origin();
  if (!adminConfigured()) return deny.bad("Falta configurar ADMIN_PASSWORD (12+ caracteres) y conectar Upstash en Vercel");
  try {
    if (await tooManyAttempts(req)) return Response.json({ error: "Demasiados intentos, espera 15 minutos" }, { status: 429 });
  } catch {
    return deny.down();
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !checkPassword(parsed.data.password)) return deny.auth();
  return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(), "Cache-Control": "no-store" } });
}
