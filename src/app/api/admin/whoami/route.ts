import { roleOf } from "@/lib/auth";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

// ¿Quién entró al panel? "owner" (todo) o "staff" (solo Hoy). 401 si nadie.
export async function GET(req: Request) {
  const role = roleOf(req);
  return role ? json({ role }) : json({ error: "No autorizado" }, 401);
}
