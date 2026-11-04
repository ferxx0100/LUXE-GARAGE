import { guard, deny } from "@/lib/auth";
import { normalizeCode } from "@/lib/booking-core";
import { getBooking, liveSeal, lookupCode } from "@/lib/bookings";

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
    const [type, id] = [ref?.slice(0, 1), ref?.slice(2) ?? ""]; // "b:<id>" = reserva
    if (type === "b") {
      const b = await getBooking(id);
      if (b) {
        return Response.json({
          kind: "booking", id: b.id, code: b.code, status: b.status, name: b.name, phoneLast4: b.phone.slice(-4),
          date: b.date, time: b.time, duration: b.duration ?? 60, amount: b.amount, socio: !!b.membershipId, ...liveSeal(b.membershipId ?? b.id),
        }, { headers: noStore });
      }
    }
    return Response.json({ error: "No existe ningún recibo con ese código" }, { status: 404, headers: noStore });
  } catch {
    return deny.down();
  }
}
