import { liveSeal } from "@/lib/bookings";
import { json } from "@/lib/http";
import { memberFromRequest } from "@/lib/members";
import { localNow, memberValid } from "@/lib/booking-core";

export const dynamic = "force-dynamic";

// Sello vivo de la tarjeta de socio (el mismo que ve el empleado en "Hoy"). Solo con su sesión.
export async function GET(req: Request) {
  const m = await memberFromRequest(req).catch(() => null);
  if (!m) return json({ error: "Entra con tu celular y NIP." }, 401);
  return json({ status: memberValid(m, localNow().date) ? "confirmed" : "cancelled", ...liveSeal(m.id) });
}
