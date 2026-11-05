import { deny, guardActor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp, json } from "@/lib/http";
import { checkNip, recordVisit } from "@/lib/members";
import { z } from "zod";

export const dynamic = "force-dynamic";
const Body = z.object({ phone: z.string().max(25), nip: z.string().max(4) });

// En el lugar: el CLIENTE teclea su celular y su NIP en el celular del empleado → se registra (y sella) su lavada.
// Mismo límite de intentos que entrar a la cuenta. El empleado nunca ve el NIP guardado.
export async function POST(req: Request) {
  const g = await guardActor(req, true, "staff");
  if ("blocked" in g) return g.blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny.bad("Escribe celular y NIP");
  try {
    const who = await checkNip(parsed.data.phone, parsed.data.nip, clientIp(req));
    if (!who.ok) return json({ error: who.error }, who.status);
    const r = await recordVisit(who.value, g.actor.name);
    if (!r.ok) return json({ error: r.error }, r.status);
    await audit(g.actor.name, "Registró lavada de socio", `${who.value.code} · ${r.value.number} de ${r.value.of}`);
    return json({ ok: true, name: who.value.name.split(" ")[0], code: who.value.code, number: r.value.number, of: r.value.of, vehicle: r.value.vehicle });
  } catch {
    return deny.down();
  }
}
