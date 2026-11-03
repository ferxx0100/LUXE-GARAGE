import { guard, deny } from "@/lib/auth";
import { localNow, normalizeCode } from "@/lib/booking-core";
import { getBooking, liveSeal, lookupCode } from "@/lib/bookings";
import { getMembership, membershipBookings } from "@/lib/memberships";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

// Verificar un recibo en el panel: el empleado escribe el código que muestra el cliente y compara
// nombre, últimos 4 del teléfono, estado y el sello vivo de 3 dígitos. Solo con sesión de admin.
export async function GET(req: Request) {
  const blocked = guard(req, false);
  if (blocked) return blocked;
  const code = normalizeCode(new URL(req.url).searchParams.get("code") ?? "");
  if (!code) return deny.bad("Código inválido");
  try {
    const ref = await lookupCode(code);
    const [type, id] = [ref?.slice(0, 1), ref?.slice(2) ?? ""];
    if (type === "b") {
      const b = await getBooking(id);
      if (b) {
        return Response.json({
          kind: "booking", id: b.id, code: b.code, status: b.status, name: b.name, phoneLast4: b.phone.slice(-4),
          date: b.date, time: b.time, duration: b.duration ?? 60, amount: b.amount, ...liveSeal(b.id),
        }, { headers: noStore });
      }
    }
    if (type === "m") {
      const m = await getMembership(id);
      if (m) {
        const washes = (await membershipBookings(m)).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
        // La lavada que toca: la de hoy, si no la próxima pendiente, si no la última.
        const today = localNow().date;
        const cur = washes.find((w) => w.date === today) ?? washes.find((w) => w.date > today && w.status === "confirmed") ?? washes.at(-1);
        return Response.json({
          kind: "membership", id: cur?.id ?? m.id, code: m.code, membershipId: m.id,
          status: cur?.status ?? m.status, membershipStatus: m.status, name: m.name, phoneLast4: m.phone.slice(-4),
          date: cur?.date ?? null, time: cur?.time ?? null, duration: m.duration, validTo: m.validTo, ...liveSeal(m.id),
          washes: washes.map((w) => ({ id: w.id, date: w.date, time: w.time, status: w.status })),
        }, { headers: noStore });
      }
    }
    return Response.json({ error: "No existe ningún recibo con ese código" }, { status: 404, headers: noStore });
  } catch {
    return deny.down();
  }
}
