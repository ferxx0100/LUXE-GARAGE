import { guard, deny, roleOf } from "@/lib/auth";
import { localNow, maskName } from "@/lib/booking-core";
import { liveSeal, listBookings } from "@/lib/bookings";
import { busyUntilText, getGarage, openState, toPublic } from "@/lib/garage-state";
import { json } from "@/lib/http";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// "Hoy": quién viene hoy, para el empleado y el dueño. Sin teléfonos, correos, precios ni direcciones.
// El sello vivo es el mismo que muestra el celular del cliente (socio: su tarjeta; lavada suelta: su recibo).
export async function GET(req: Request) {
  const blocked = guard(req, false, "staff");
  if (blocked) return blocked;
  try {
    const today = localNow().date;
    const [s, g, list] = await Promise.all([getSettings(), getGarage(), listBookings([today])]);
    const items = list
      .filter((b) => ["confirmed", "pending", "done", "conflict"].includes(b.status))
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((b) => ({
        id: b.id, time: b.time, duration: b.duration ?? 30, name: maskName(b.name),
        socio: !!b.membershipId, vehicle: b.vehicle ?? null, status: b.status,
        ...liveSeal(b.membershipId ?? b.id),
      }));
    return json({
      role: roleOf(req),
      garage: { ...g, public: toPublic(g, s.hours).status, reason: openState(g, s.hours).reason, busyUntil: busyUntilText(g) },
      items,
    });
  } catch {
    return deny.down();
  }
}
