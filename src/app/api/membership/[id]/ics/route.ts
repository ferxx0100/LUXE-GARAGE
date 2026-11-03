import { icsForMembership } from "@/lib/mail";
import { getMembership } from "@/lib/memberships";

export const dynamic = "force-dynamic";

// Las 6 lavadas de la membresía en un solo archivo de calendario (alarma 1 h antes de cada una).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMembership(id).catch(() => null);
  if (!m || !["confirmed", "pending"].includes(m.status)) return new Response("No encontrada", { status: 404 });
  return new Response(icsForMembership(m), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${m.code}.ics"`, "Cache-Control": "no-store" },
  });
}
