import { deny, guard } from "@/lib/auth";
import { adminAction } from "@/lib/bookings";
import { z } from "zod";

export const dynamic = "force-dynamic";
const Body = z.object({ action: z.enum(["done", "cancel", "confirm"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guard(req, true);
  if (blocked) return blocked;
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny.bad();
  try {
    const b = await adminAction(id, parsed.data.action);
    return b ? Response.json(b, { headers: { "Cache-Control": "no-store" } }) : deny.bad("No existe");
  } catch {
    return deny.down();
  }
}
