import { getBooking } from "@/lib/bookings";
import { icsFor } from "@/lib/mail";

export const dynamic = "force-dynamic";

// Archivo para "Agregar a mi calendario" (iPhone, Android, Google Calendar). Con su duración real.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBooking(id).catch(() => null);
  if (!b || !["confirmed", "done", "pending"].includes(b.status)) return new Response("No encontrada", { status: 404 });
  return new Response(icsFor(b), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${b.code}.ics"`, "Cache-Control": "no-store" },
  });
}
