import { getGarage, toPublic } from "@/lib/garage-state";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Público: solo el estado, nunca datos de quién está. La CDN de Vercel lo guarda 2 s:
// miles de visitantes = una lectura al almacén cada 2 s, no una por visitante.
export async function GET() {
  try {
    const [rec, s] = await Promise.all([getGarage(), getSettings()]);
    return Response.json(toPublic(rec, s.hours), {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=2, stale-while-revalidate=10" },
    });
  } catch {
    return Response.json({ error: "No disponible" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
