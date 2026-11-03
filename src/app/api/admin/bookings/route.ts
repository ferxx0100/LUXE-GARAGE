import { deny, guard } from "@/lib/auth";
import { addDays, isDateStr } from "@/lib/booking-core";
import { listBookings } from "@/lib/bookings";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = guard(req, false);
  if (blocked) return blocked;
  const q = new URL(req.url).searchParams;
  const from = q.get("from") ?? "";
  const days = Math.min(31, Math.max(1, Number(q.get("days") ?? 7)));
  if (!isDateStr(from)) return deny.bad("Fecha inválida");
  try {
    const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
    return Response.json({ bookings: await listBookings(dates) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return deny.down();
  }
}
