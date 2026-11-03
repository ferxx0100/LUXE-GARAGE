import { isDateStr } from "@/lib/booking-core";
import { availability } from "@/lib/bookings";

export const dynamic = "force-dynamic";

// Público: horarios libres/ocupados de un día. Caché corta en la CDN.
export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!isDateStr(date)) return Response.json({ error: "Fecha inválida" }, { status: 400 });
  try {
    return Response.json({ date, slots: await availability(date) }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=3, stale-while-revalidate=10" } });
  } catch {
    return Response.json({ error: "No disponible" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
