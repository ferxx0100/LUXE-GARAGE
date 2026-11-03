import { publicGarage } from "@/lib/bookings";

export const dynamic = "force-dynamic";

// Público: estado, hora y próximo lugar libre; nunca datos de quién está. La CDN de Vercel lo guarda 4 s:
// miles de visitantes = unas cuantas lecturas al almacén, no una por visitante.
export async function GET() {
  try {
    return Response.json(await publicGarage(), {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=4, stale-while-revalidate=4" },
    });
  } catch {
    return Response.json({ error: "No disponible" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
