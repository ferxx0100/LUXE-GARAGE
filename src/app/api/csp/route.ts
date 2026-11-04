import { clientIp } from "@/lib/http";
import { scrub } from "@/lib/clientlog";
import { kvIncr } from "@/lib/store";

export const dynamic = "force-dynamic";

// Reportes de la política de seguridad (CSP): qué dominio bloqueó el navegador y en qué regla.
// Sirve para saber si el formulario de Mercado Pago necesita un dominio más.
export async function POST(req: Request) {
  try {
    if ((await kvIncr(`lg:rl:csp:${clientIp(req)}`, 600)) > 30) return new Response(null, { status: 204 });
    const body = await req.json().catch(() => null) as Record<string, unknown> | Record<string, unknown>[] | null;
    const list = Array.isArray(body) ? body.map((x) => (x as { body?: Record<string, unknown> }).body ?? x) : [((body as { "csp-report"?: Record<string, unknown> } | null)?.["csp-report"]) ?? body];
    for (const r of list.slice(0, 5)) {
      if (!r) continue;
      const blocked = String(r["blocked-uri"] ?? r.blockedURL ?? "");
      let host = blocked;
      try { host = new URL(blocked).origin; } catch { /* "inline", "eval", etc. */ }
      console.error("csp bloqueó:", scrub(r["effective-directive"] ?? r.effectiveDirective ?? r["violated-directive"], 40), scrub(host, 120), "en", scrub(String(r["document-uri"] ?? r.documentURL ?? "").replace(/\?.*$/, ""), 80));
    }
  } catch { /* nada */ }
  return new Response(null, { status: 204 });
}
