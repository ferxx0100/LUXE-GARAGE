import { canChange, localNow } from "@/lib/booking-core";
import { json } from "@/lib/http";
import { memberFromRequest, memberWashes, publicMember, syncMember, usedThisPeriod } from "@/lib/members";

export const dynamic = "force-dynamic";

// La cuenta del socio: su estado, sus lavadas del mes y cuáles todavía se pueden cambiar (> 72 h).
export async function GET(req: Request) {
  try {
    const found = await memberFromRequest(req);
    if (!found) return json({ error: "Entra con tu celular y NIP." }, 401);
    const m = await syncMember(found);
    const now = localNow();
    const list = await memberWashes(m);
    const inPeriod = list.filter((b) => !!m.periodStart && !!m.periodEnd && b.date >= m.periodStart && b.date < m.periodEnd && b.status !== "cancelled");
    return json({
      member: publicMember(m, now.date),
      used: usedThisPeriod(m, list),
      washes: inPeriod.map((b) => ({
        id: b.id, date: b.date, time: b.time, duration: b.duration,
        past: b.date < now.date || (b.date === now.date && Number(b.time.slice(0, 2)) * 60 + Number(b.time.slice(3)) + b.duration <= now.minutes),
        canChange: canChange(b.date, b.time, now),
      })),
    });
  } catch {
    return json({ error: "No pudimos cargar tu cuenta. Intenta de nuevo." }, 503);
  }
}
