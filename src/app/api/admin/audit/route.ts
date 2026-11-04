import { deny, guardActor } from "@/lib/auth";
import { recentAudit } from "@/lib/audit";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

// Movimientos recientes (solo el dueño): quién abrió, cerró, selló, cambió precios, etc.
export async function GET(req: Request) {
  const g = await guardActor(req, false);
  if ("blocked" in g) return g.blocked;
  try { return json({ items: await recentAudit(200) }); } catch { return deny.down(); }
}
