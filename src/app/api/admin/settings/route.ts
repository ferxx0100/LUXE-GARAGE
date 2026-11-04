import { deny, guard, guardActor } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { busyUntilText, getGarage, openState, toPublic } from "@/lib/garage-state";
import { getSettings, saveSettings, Settings } from "@/lib/settings";
import { storeKind } from "@/lib/store";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const blocked = guard(req, false);
  if (blocked) return blocked;
  try {
    const [settings, garage] = await Promise.all([getSettings(), getGarage()]);
    return Response.json({ settings, garage: { ...garage, public: toPublic(garage, settings.hours).status, reason: openState(garage, settings.hours).reason, busyUntil: busyUntilText(garage) }, storage: storeKind }, { headers: noStore });
  } catch {
    return deny.down();
  }
}

export async function PUT(req: Request) {
  const g = await guardActor(req, true);
  if ("blocked" in g) return g.blocked;
  const parsed = Settings.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny.bad(parsed.error.issues[0]?.message ?? "Datos inválidos");
  try {
    const before = await getSettings();
    await saveSettings(parsed.data);
    const d = parsed.data;
    const money = (label: string, x: number, y: number) => (x !== y ? `${label} $${x}→$${y}` : "");
    const changes = [
      money("suscripción carro", before.socio.carro, d.socio.carro),
      money("suscripción camioneta", before.socio.camioneta, d.socio.camioneta),
      money("lavada normal carro", before.single.carro, d.single.carro),
      money("lavada normal camioneta", before.single.camioneta, d.single.camioneta),
      before.memberCap !== d.memberCap ? `tope ${before.memberCap}→${d.memberCap}` : "",
      JSON.stringify(before.hours) !== JSON.stringify(d.hours) ? "horario" : "",
    ].filter(Boolean).join(" · ");
    await audit(g.actor.name, "Cambió ajustes", changes || "sin cambios de precio");
  } catch {
    return deny.down();
  }
  revalidatePath("/"); // la página pública se regenera con los nuevos precios/horario
  return Response.json({ settings: parsed.data }, { headers: noStore });
}
