import { GarageMode, memoryStore, safeEqual } from "@/lib/garage-state";
import { z } from "zod";

export const dynamic = "force-dynamic";
const Body = z.object({ mode: GarageMode });

export async function POST(req: Request) {
  const key = process.env.ADMIN_API_KEY ?? "";
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  // Sin clave configurada o clave incorrecta: mismo 401 genérico.
  if (!key || !safeEqual(given, key)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Solicitud inválida" }, { status: 400 });

  const rec = await memoryStore.set(parsed.data.mode);
  return Response.json(rec);
}
