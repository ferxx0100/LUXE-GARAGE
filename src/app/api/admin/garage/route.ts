import { deny, guardActor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { busyUntilText, openState, patchGarage, toPublic } from "@/lib/garage-state";
import { getSettings } from "@/lib/settings";
import { z } from "zod";

export const dynamic = "force-dynamic";
const Body = z.object({
  mode: z.enum(["auto", "open", "closed"]).optional(),
  busy: z.boolean().optional(),
  minutes: z.union([z.literal(20), z.literal(30), z.literal(50), z.literal(60), z.literal(100)]).optional(),
}).refine((b) => b.mode !== undefined || b.busy !== undefined);

export async function POST(req: Request) {
  const g = await guardActor(req, true, "staff"); // el empleado también abre/cierra y marca libre/ocupado
  if ("blocked" in g) return g.blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny.bad();
  try {
    const rec = await patchGarage(parsed.data);
    const d = parsed.data;
    await audit(g.actor.name, d.mode ? { auto: "Negocio: automático", open: "Abrió hoy", closed: "Cerró hoy" }[d.mode] : d.busy ? "Marcó OCUPADO" : "Marcó LIBRE");
    const s = await getSettings();
    return Response.json(
      { ...rec, public: toPublic(rec, s.hours).status, reason: openState(rec, s.hours).reason, busyUntil: busyUntilText(rec) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return deny.down();
  }
}
