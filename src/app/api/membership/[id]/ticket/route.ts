import { membershipTicket } from "@/lib/booking-core";
import { getMembership } from "@/lib/memberships";
import { ticketImage } from "@/lib/ticket";

export const dynamic = "force-dynamic";

// Ticket de la membresía (sus lavadas) en imagen para guardarlo en el celular. Solo si ya se pagó.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMembership(id).catch(() => null);
  if (!m || !["confirmed", "pending"].includes(m.status)) return new Response("No encontrada", { status: 404, headers: { "Cache-Control": "no-store" } });
  return ticketImage(membershipTicket(m), `${m.code}.png`);
}
