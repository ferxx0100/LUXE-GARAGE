import { liveSeal } from "@/lib/bookings";
import { getMembership, membershipBookings } from "@/lib/memberships";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

// Sello vivo de la membresía: 3 dígitos que cambian cada 30 s. Sin datos personales.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const m = await getMembership(id);
    if (!m || m.status === "hold") return Response.json({ error: "No encontrada" }, { status: 404, headers: noStore });
    // Membresía "usada" = ya se hicieron todas sus lavadas.
    const used = m.status === "confirmed" && m.bookingIds.length > 0 && (await membershipBookings(m)).every((b) => b.status === "done");
    return Response.json({ status: used ? "done" : m.status, ...liveSeal(m.id) }, { headers: noStore });
  } catch {
    return Response.json({ error: "No disponible" }, { status: 503, headers: noStore });
  }
}
