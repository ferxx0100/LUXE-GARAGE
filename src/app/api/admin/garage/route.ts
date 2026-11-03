import { deny, guard } from "@/lib/auth";
import { busyUntilText, openState, patchGarage, toPublic } from "@/lib/garage-state";
import { getSettings } from "@/lib/settings";
import { z } from "zod";

export const dynamic = "force-dynamic";
const Body = z.object({
  mode: z.enum(["auto", "open", "closed"]).optional(),
  busy: z.boolean().optional(),
  minutes: z.union([z.literal(20), z.literal(30)]).optional(),
}).refine((b) => b.mode !== undefined || b.busy !== undefined);

export async function POST(req: Request) {
  const blocked = guard(req, true);
  if (blocked) return blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny.bad();
  try {
    const rec = await patchGarage(parsed.data);
    const s = await getSettings();
    return Response.json(
      { ...rec, public: toPublic(rec, s.hours).status, reason: openState(rec, s.hours).reason, busyUntil: busyUntilText(rec) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return deny.down();
  }
}
