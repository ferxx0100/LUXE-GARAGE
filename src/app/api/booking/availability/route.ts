import { isDateStr } from "@/lib/booking-core";
import { availability } from "@/lib/bookings";

export const dynamic = "force-dynamic";

// Público: horas libres de un día para un servicio (completo 30 min, exterior 20 min). Caché corta en la CDN.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const date = q.get("date") ?? "";
  const kind = q.get("kind") ?? "completo";
  if (!isDateStr(date)) return Response.json({ error: "Fecha inválida" }, { status: 400 });
  if (kind !== "completo" && kind !== "exterior") return Response.json({ error: "Servicio inválido" }, { status: 400 });
  try {
    return Response.json(await availability(date, kind), { headers: { "Cache-Control": "public, max-age=0, s-maxage=3, stale-while-revalidate=10" } });
  } catch {
    return Response.json({ error: "No disponible" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
