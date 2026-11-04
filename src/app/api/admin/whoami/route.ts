import { actorOf } from "@/lib/auth";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

// ¿Quién entró al panel? Dueño (todo) o empleado (solo Hoy), con su nombre. 401 si nadie.
export async function GET(req: Request) {
  const a = await actorOf(req).catch(() => null);
  return a ? json({ role: a.role, name: a.name }) : json({ error: "No autorizado" }, 401);
}
