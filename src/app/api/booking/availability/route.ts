import { isDateStr } from "@/lib/booking-core";
import { availability } from "@/lib/bookings";

export const dynamic = "force-dynamic";

// Público: horas libres de un día. Con ?vehicle= usa lo que tarda ese tamaño (carro 50, camioneta 60, SUV 100 min).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const date = q.get("date") ?? "";
  const kind = q.get("kind") ?? "completo";
  if (!isDateStr(date)) return Response.json({ error: "Fecha inválida" }, { status: 400 });
  if (kind !== "completo" && kind !== "exterior") return Response.json({ error: "Servicio inválido" }, { status: 400 });
  const v = q.get("vehicle");
  if (v !== null && v !== "carro" && v !== "camioneta" && v !== "suv") return Response.json({ error: "Vehículo inválido" }, { status: 400 });
  const sv = q.get("service");
  if (sv !== null && sv !== "sencillo" && sv !== "profundo" && sv !== "detallado") return Response.json({ error: "Servicio inválido" }, { status: 400 });
  try {
    return Response.json(await availability(date, kind, v ?? undefined, sv ?? undefined), { headers: { "Cache-Control": "public, max-age=0, s-maxage=3, stale-while-revalidate=10" } });
  } catch {
    return Response.json({ error: "No disponible" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
