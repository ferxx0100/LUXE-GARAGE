import { bookingTicket } from "@/lib/booking-core";
import { durationOf, getBooking } from "@/lib/bookings";
import { BUSINESS } from "@/lib/config";
import { ticketImage } from "@/lib/ticket";

export const dynamic = "force-dynamic";

// Ticket en imagen para guardarlo en el celular. Solo reservas pagadas o en revisión (enlace secreto).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBooking(id).catch(() => null);
  if (!b || !["confirmed", "done", "pending"].includes(b.status)) return new Response("No encontrada", { status: 404, headers: { "Cache-Control": "no-store" } });
  return ticketImage(bookingTicket({ ...b, duration: durationOf(b) }, BUSINESS.location), `${b.code}.png`);
}
