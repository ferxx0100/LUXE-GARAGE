import { sameOrigin } from "@/lib/auth";
import { json } from "@/lib/http";
import { sendMemberWelcome } from "@/lib/mail";
import { getMember, memberCookie, memberFromRequest, subscribe } from "@/lib/members";
import { CardFormSchema, mpReason } from "@/lib/payments/mercadopago";
import { redis } from "@/lib/store";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Body = z.object({ id: z.string().max(40).optional(), form: CardFormSchema });

// Hazte socio, paso 2 (o renovar): el Brick manda el token de la tarjeta y creamos el cobro automático mensual.
// Alta nueva: con el id que regresó /signup (solo existe "pending"). Renovar: con la sesión del socio.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Origen no permitido" }, 403);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Datos de pago incompletos" }, 400);
  try {
    const session = await memberFromRequest(req);
    const byId = parsed.data.id ? await getMember(parsed.data.id) : null;
    const m = session ?? (byId?.status === "pending" ? byId : null);
    if (!m) return json({ error: "Vuelve a empezar tu alta." }, 404);
    const email = parsed.data.form.payer?.email?.trim().toLowerCase() ?? "";
    if (!email) return json({ error: "Escribe tu correo en el formulario de pago" }, 400);
    const r = await subscribe(m, parsed.data.form.token, email);
    if (!r.ok) return json({ error: r.error }, r.status);
    const member = r.value;
    if (member.status === "active" && (await redis("SET", `lg:mem:welcome:${member.id}`, "1", "NX", "EX", 400 * 24 * 3600)) === "OK") {
      await sendMemberWelcome(member).catch(() => {});
    }
    // Entra de una vez a su cuenta: ahí ve su tarjeta y aparta sus lavadas.
    return json({ status: member.status }, 200, { "Set-Cookie": memberCookie(member) });
  } catch (e) {
    console.error("suscripción falló:", mpReason(e));
    return json({ error: "No pudimos completar el pago. Revisa tu cuenta en unos minutos antes de intentar otra vez." }, 502);
  }
}
