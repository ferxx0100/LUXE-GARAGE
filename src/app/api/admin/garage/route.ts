import { deny, guard } from "@/lib/auth";
import { GarageMode, setGarage } from "@/lib/garage-state";
import { z } from "zod";

export const dynamic = "force-dynamic";
const Body = z.object({ mode: GarageMode });

export async function POST(req: Request) {
  const blocked = guard(req, true);
  if (blocked) return blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny.bad();
  try {
    return Response.json(await setGarage(parsed.data.mode), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return deny.down();
  }
}
