import { adminConfigured, checkPassword, deny, recordFail, sameOrigin, sessionCookie, tooManyAttempts } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { staffByPin } from "@/lib/staff";
import { z } from "zod";

const Body = z.object({ password: z.string().min(1).max(200) });

// Dueño: su contraseña. Empleado: su PIN de 6 dígitos (o STAFF_PASSWORD si existe).
export async function POST(req: Request) {
  if (!sameOrigin(req)) return deny.origin();
  if (!adminConfigured()) return deny.bad("Falta conectar Upstash en Vercel");
  try {
    if (await tooManyAttempts(req)) return Response.json({ error: "Demasiados intentos, espera 15 minutos" }, { status: 429 });
  } catch {
    return deny.down();
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const given = parsed.success ? parsed.data.password.trim() : "";
  let role = given ? checkPassword(given) : null;
  let who = role === "owner" ? "owner" : "env";
  let name = role === "owner" ? "Dueño" : "Empleado";
  if (!role && /^\d{6}$/.test(given)) {
    const st = await staffByPin(given).catch(() => null);
    if (st) { role = "staff"; who = st.id; name = st.name; }
  }
  if (!role) {
    await recordFail(req).catch(() => {});
    return Response.json({ error: "Contraseña o PIN incorrecto" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  await audit(name, "Entró al panel");
  return Response.json({ ok: true, role, name }, { headers: { "Set-Cookie": sessionCookie(role, who), "Cache-Control": "no-store" } });
}
