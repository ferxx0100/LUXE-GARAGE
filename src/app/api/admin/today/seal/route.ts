import { deny, guardActor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { localNow } from "@/lib/booking-core";
import { getBooking, isBookingId, kvSave } from "@/lib/bookings";
import { json } from "@/lib/http";
import { z } from "zod";

export const dynamic = "force-dynamic";
const Body = z.object({ id: z.string() });

// Sellar la lavada de HOY: queda como hecha, con quién la selló y a qué hora. No se puede sellar dos veces.
export async function POST(req: Request) {
  const g = await guardActor(req, true, "staff");
  if ("blocked" in g) return g.blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isBookingId(parsed.data.id)) return deny.bad();
  try {
    const b = await getBooking(parsed.data.id);
    if (!b || b.date !== localNow().date) return json({ error: "Esa reserva no es de hoy." }, 404);
    if (b.status === "done") return json({ error: `Ya se selló${b.doneBy ? ` (${b.doneBy})` : ""}.` }, 409);
    if (b.status !== "confirmed") return json({ error: "Sin pago confirmado: no se puede sellar." }, 409);
    const next = await kvSave({ ...b, status: "done", doneBy: g.actor.name, doneAt: new Date().toISOString() });
    await audit(g.actor.name, "Selló lavada", `${b.code} · ${b.membershipId ? "socio" : "individual"} · ${b.time}`);
    return json({ ok: true, status: next.status, doneBy: next.doneBy });
  } catch {
    return deny.down();
  }
}
