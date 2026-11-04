import { guard, deny } from "@/lib/auth";
import { localNow, memberValid } from "@/lib/booking-core";
import { getBookings } from "@/lib/bookings";
import { json } from "@/lib/http";
import { listMembers, usedThisPeriod } from "@/lib/members";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Socios (solo el dueño): estado, vigencia y lavadas del mes. Nunca la huella del NIP.
export async function GET(req: Request) {
  const blocked = guard(req, false);
  if (blocked) return blocked;
  try {
    const today = localNow().date;
    const [s, all] = await Promise.all([getSettings(), listMembers()]);
    const rows = await Promise.all(all.filter((m) => m.status !== "pending" || m.preapprovalId).map(async (m) => ({
      id: m.id, code: m.code, name: m.name, phone: m.phone, vehicle: m.vehicle, status: m.status,
      valid: memberValid(m, today), periodEnd: m.periodEnd ?? null, perPeriod: m.perPeriod,
      used: usedThisPeriod(m, await getBookings(m.bookingIds)),
    })));
    rows.sort((a, b) => Number(b.valid) - Number(a.valid) || a.name.localeCompare(b.name));
    return json({ cap: s.memberCap, active: rows.filter((r) => r.valid).length, members: rows });
  } catch {
    return deny.down();
  }
}
