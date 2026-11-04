import { clientIp } from "@/lib/http";
import { scrub } from "@/lib/clientlog";
import { kvIncr } from "@/lib/store";

export const dynamic = "force-dynamic";

// Errores del formulario de pago en el celular del cliente, para poder arreglarlos.
// Solo texto técnico (sin datos de tarjeta ni personales), con límite por IP.
export async function POST(req: Request) {
  try {
    if ((await kvIncr(`lg:rl:log:${clientIp(req)}`, 600)) > 30) return new Response(null, { status: 204 });
    const d = (await req.json().catch(() => ({}))) as { where?: unknown; msg?: unknown };
    console.error("navegador:", scrub(d.where, 40), "|", scrub(d.msg));
  } catch { /* nunca falla hacia el cliente */ }
  return new Response(null, { status: 204 });
}
