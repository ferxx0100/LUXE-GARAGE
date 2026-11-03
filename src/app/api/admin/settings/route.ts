import { deny, guard } from "@/lib/auth";
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
  const blocked = guard(req, true);
  if (blocked) return blocked;
  const parsed = Settings.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny.bad(parsed.error.issues[0]?.message ?? "Datos inválidos");
  try {
    await saveSettings(parsed.data);
  } catch {
    return deny.down();
  }
  revalidatePath("/"); // la página pública se regenera con los nuevos precios/horario
  return Response.json({ settings: parsed.data }, { headers: noStore });
}
