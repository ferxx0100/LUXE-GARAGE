import { getBooking } from "@/lib/bookings";
import { BUSINESS } from "@/lib/config";

export const dynamic = "force-dynamic";

// Archivo para "Agregar a mi calendario" (iPhone, Android, Google Calendar).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBooking(id).catch(() => null);
  if (!b || !["confirmed", "done", "pending"].includes(b.status)) return new Response("No encontrada", { status: 404 });
  const [y, m, d] = b.date.split("-");
  const [hh, mm] = b.time.split(":");
  const start = `${y}${m}${d}T${hh}${mm}00`;
  const end = `${y}${m}${d}T${String(Number(hh) + 1).padStart(2, "0")}${mm}00`;
  const where = b.place === "domicilio" ? "A domicilio" : BUSINESS.location;
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, " ");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LUXE GARAGE//Reservas//ES", "BEGIN:VEVENT",
    `UID:${b.code}@luxegaragee.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;TZID=${BUSINESS.timezone}:${start}`, `DTEND;TZID=${BUSINESS.timezone}:${end}`,
    `SUMMARY:${esc(`Lavado LUXE GARAGE · ${b.code}`)}`, `LOCATION:${esc(where)}`,
    `DESCRIPTION:${esc(`Reserva ${b.code}. Ayuda: +${BUSINESS.phone}`)}`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${b.code}.ics"`, "Cache-Control": "no-store" } });
}
