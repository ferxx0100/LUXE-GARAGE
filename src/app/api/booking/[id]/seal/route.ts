import { getBooking, liveSeal } from "@/lib/bookings";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

// Sello vivo del comprobante: 3 dígitos que cambian cada 30 s. Sin datos personales.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const b = await getBooking(id);
    if (!b || b.status === "hold") return Response.json({ error: "No encontrada" }, { status: 404, headers: noStore });
    return Response.json({ status: b.status, ...liveSeal(b.id) }, { headers: noStore });
  } catch {
    return Response.json({ error: "No disponible" }, { status: 503, headers: noStore });
  }
}
