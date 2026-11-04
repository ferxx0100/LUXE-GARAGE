import { guard, deny } from "@/lib/auth";
import { localNow, memberValid } from "@/lib/booking-core";
import { getBookings } from "@/lib/bookings";
import { json } from "@/lib/http";
import { listMembers, memberPayments, usedThisPeriod } from "@/lib/members";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Socios (solo el dueño): estado, vigencia y lavadas del mes. Nunca la huella del NIP.
export async function GET(req: Request) {
  const blocked = guard(req, false);
  if (blocked) return blocked;
  try {
    const today = localNow().date;
    const [s, all] = await Promise.all([getSettings(), listMembers()]);
    const rows = await Promise.all(all.filter((m) => m.status !== "pending" || m.preapprovalId).map(async (m) => {
      const washes = await getBookings(m.bookingIds);
      return {
        id: m.id, code: m.code, name: m.name, phone: m.phone, vehicle: m.vehicle, status: m.status,
        valid: memberValid(m, today), periodEnd: m.periodEnd ?? null, perPeriod: m.perPeriod,
        used: usedThisPeriod(m, washes),
        payments: await memberPayments(m.id),
        history: washes.filter((b) => b.status === "done" || b.status === "confirmed").sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 12)
          .map((b) => ({ date: b.date, time: b.time, status: b.status, doneBy: b.doneBy ?? null })),
      };
    }));
    rows.sort((a, b) => Number(b.valid) - Number(a.valid) || a.name.localeCompare(b.name));
    return json({ cap: s.memberCap, active: rows.filter((r) => r.valid).length, members: rows });
  } catch {
    return deny.down();
  }
}
