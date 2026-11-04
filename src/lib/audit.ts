// Historial de movimientos: solo se agrega, nunca se edita ni se borra desde el panel.
// Cada registro: cuándo, quién (Dueño o el nombre del empleado), qué hizo y sobre qué.
// Sin teléfonos, correos ni datos de tarjeta (regla B11).
import { randomBytes } from "node:crypto";
import { redis } from "./store";

const KEY = "lg:audit";
export interface AuditEntry { at: string; who: string; action: string; detail: string }

export async function audit(who: string, action: string, detail = ""): Promise<void> {
  const e: AuditEntry & { r: string } = { at: new Date().toISOString(), who: who.slice(0, 40), action: action.slice(0, 60), detail: detail.slice(0, 160), r: randomBytes(4).toString("hex") };
  await redis("ZADD", KEY, Date.now(), JSON.stringify(e)).catch(() => console.error("historial: no se guardó", action));
}

export async function recentAudit(limit = 200): Promise<AuditEntry[]> {
  const raw = await redis<string[]>("ZRANGE", KEY, -limit, -1);
  return raw.slice(-limit).reverse().map((s) => { const { r: _r, ...e } = JSON.parse(s) as AuditEntry & { r: string }; return e; });
}
