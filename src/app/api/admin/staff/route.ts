import { deny, guardActor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json } from "@/lib/http";
import { addStaff, listStaff, newStaffPin, publicStaff, setStaffActive } from "@/lib/staff";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Equipo (solo el dueño): alta con nombre → PIN de 6 dígitos que se muestra UNA vez; baja; PIN nuevo.
export async function GET(req: Request) {
  const g = await guardActor(req, false);
  if ("blocked" in g) return g.blocked;
  try { return json({ staff: (await listStaff()).map(publicStaff) }); } catch { return deny.down(); }
}

const Body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), name: z.string().trim().min(2).max(40) }),
  z.object({ op: z.literal("pin"), id: z.string().max(20) }),
  z.object({ op: z.literal("active"), id: z.string().max(20), active: z.boolean() }),
]);

export async function POST(req: Request) {
  const g = await guardActor(req, true);
  if ("blocked" in g) return g.blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny.bad("Escribe el nombre del empleado");
  try {
    const d = parsed.data;
    if (d.op === "add") {
      const r = await addStaff(d.name);
      await audit(g.actor.name, "Dio de alta empleado", r.staff.name);
      return json({ staff: publicStaff(r.staff), pin: r.pin });
    }
    if (d.op === "pin") {
      const r = await newStaffPin(d.id);
      if (!r) return deny.bad();
      await audit(g.actor.name, "PIN nuevo a empleado", r.staff.name);
      return json({ staff: publicStaff(r.staff), pin: r.pin });
    }
    const st = await setStaffActive(d.id, d.active);
    if (!st) return deny.bad();
    await audit(g.actor.name, d.active ? "Reactivó empleado" : "Dio de baja empleado", st.name);
    return json({ staff: publicStaff(st) });
  } catch {
    return deny.down();
  }
}
