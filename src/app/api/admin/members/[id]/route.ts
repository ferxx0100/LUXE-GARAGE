import { guard, deny } from "@/lib/auth";
import { json } from "@/lib/http";
import { resetNip } from "@/lib/members";
import { z } from "zod";

export const dynamic = "force-dynamic";
const Body = z.object({ action: z.literal("reset-nip") });

// Restablecer el NIP de un socio que lo olvidó (solo el dueño). El NIP nuevo se muestra UNA vez para dárselo.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guard(req, true);
  if (blocked) return blocked;
  if (!Body.safeParse(await req.json().catch(() => null)).success) return deny.bad();
  try {
    const { id } = await params;
    const r = await resetNip(id);
    return r ? json({ nip: r.nip, name: r.member.name }) : json({ error: "Socio no encontrado" }, 404);
  } catch {
    return deny.down();
  }
}
