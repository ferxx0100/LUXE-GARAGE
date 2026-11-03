import { deny, guard } from "@/lib/auth";
import { patchGarage } from "@/lib/garage-state";
import { z } from "zod";

export const dynamic = "force-dynamic";
const Body = z.object({ open: z.boolean().optional(), busy: z.boolean().optional() })
  .refine((b) => b.open !== undefined || b.busy !== undefined);

export async function POST(req: Request) {
  const blocked = guard(req, true);
  if (blocked) return blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny.bad();
  try {
    return Response.json(await patchGarage(parsed.data), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return deny.down();
  }
}
