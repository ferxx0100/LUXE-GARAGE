import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getStaff } from "./staff";
import { kvIncr, redis } from "./store";

const COOKIE = "lg_admin";
const TTL = 60 * 60 * 12; // 12 h
const MAX_FAILS = 8; // intentos FALLIDOS permitidos por IP en la ventana
const WINDOW = 15 * 60;

const sha = (s: string) => createHash("sha256").update(s).digest();

// Contraseña del panel definida por el dueño. Solo guardamos su huella scrypt (sal:hash),
// nunca el texto. Si existe ADMIN_PASSWORD en Vercel, también se acepta esa.
const PANEL_HASH = "5184e8e5b7982cec94e9d90ae7ff26b6:d11a4120201584c12eafb45ec3814a2f54bca959a6cfb36574fe11a63b5ea108";
const envPass = () => (process.env.ADMIN_PASSWORD ?? "").trim();

// Llave para firmar la sesión. Si no hay ADMIN_SESSION_SECRET, se deriva sola de la
// contraseña + el token de Upstash (largo y secreto), así basta con ADMIN_PASSWORD.
// Cambiar la contraseña invalida las sesiones abiertas.
function secret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (s && s.length >= 32) return s;
  const pass = envPass() || PANEL_HASH;
  const kv = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
  if (kv.length < 20) return null;
  return createHash("sha256").update(`lg-session|${pass}|${kv}`).digest("base64url");
}
const sign = (payload: string, s: string) => createHmac("sha256", s).update(payload).digest("base64url");

// Llave para el sello vivo de los comprobantes. Deriva de la misma llave secreta del servidor
// (nunca sale de aquí). Sin almacén configurado (desarrollo local) usa una al azar por proceso.
const g = globalThis as unknown as { __lgDevKey?: string };
export function serverKey(): string {
  const base = secret() ?? (g.__lgDevKey ??= randomBytes(32).toString("base64url"));
  return createHash("sha256").update(`lg-seal|${base}`).digest("base64url");
}

export function adminConfigured(): boolean {
  return !!secret();
}

/** Dueño: todo el panel. Empleado: solo "Hoy" (quién viene, sello) y abrir/cerrar, libre/ocupado. */
export type Role = "owner" | "staff";

/**
 * Dueño: contraseña del panel (huella scrypt) o ADMIN_PASSWORD. Empleado: STAFF_PASSWORD (variable en Vercel).
 * Ignora espacios al inicio/fin. Devuelve el rol o null.
 */
export function checkPassword(raw: string): Role | null {
  const given = raw.trim();
  const [salt, hex] = PANEL_HASH.split(":");
  const panelOk = timingSafeEqual(scryptSync(given, salt, 32, { N: 16384, r: 8, p: 1 }), Buffer.from(hex, "hex"));
  const p = envPass();
  const envOk = p.length >= 8 && timingSafeEqual(sha(given), sha(p)); // hash = misma longitud, sin filtrar el tamaño
  if (panelOk || envOk) return "owner";
  const st = (process.env.STAFF_PASSWORD ?? "").trim();
  if (st.length >= 8 && st !== p && timingSafeEqual(sha(given), sha(st))) return "staff";
  return null;
}

const cookieAttrs = "Path=/api/admin; HttpOnly; Secure; SameSite=Strict";

/** who: "owner", "env" (STAFF_PASSWORD) o el id del empleado (su PIN). */
export function sessionCookie(role: Role, who: string = role === "owner" ? "owner" : "env"): string {
  const s = secret()!;
  const v = `${Math.floor(Date.now() / 1000) + TTL}.${role}.${who}`;
  return `${COOKIE}=${v}.${sign(v, s)}; ${cookieAttrs}; Max-Age=${TTL}`;
}
export const clearCookie = `${COOKIE}=; ${cookieAttrs}; Max-Age=0`;

/** Sesión del panel (firma y vigencia): rol y quién es, o null. */
export function sessionOf(req: Request): { role: Role; who: string } | null {
  const s = secret();
  if (!s) return null;
  const raw = (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  const [exp, role, who, mac] = (raw?.slice(COOKIE.length + 1) ?? "").split(".");
  if (!exp || !who || !mac || (role !== "owner" && role !== "staff") || Number(exp) < Date.now() / 1000) return null;
  return timingSafeEqual(sha(mac), sha(sign(`${exp}.${role}.${who}`, s))) ? { role, who } : null;
}
export const roleOf = (req: Request): Role | null => sessionOf(req)?.role ?? null;

/** Quién hace la acción (para el historial). Un empleado dado de baja ya no cuenta como sesión. */
export async function actorOf(req: Request): Promise<{ role: Role; who: string; name: string } | null> {
  const ses = sessionOf(req);
  if (!ses) return null;
  if (ses.role === "owner") return { ...ses, name: "Dueño" };
  if (ses.who === "env") return { ...ses, name: "Empleado" };
  const st = await getStaff(ses.who);
  return st?.active ? { ...ses, name: st.name } : null;
}
export const isAuthed = (req: Request) => roleOf(req) !== null;

/** Protección CSRF básica: las mutaciones deben venir de nuestro propio sitio. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try { return !!origin && !!host && new URL(origin).host === host; } catch { return false; }
}

const failKey = (req: Request) => `lg:rl:login2:${(req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim()}`;

/** Solo cuentan los intentos FALLIDOS; entrar bien no gasta intentos. */
export async function tooManyAttempts(req: Request): Promise<boolean> {
  return Number((await redis<string | null>("GET", failKey(req))) ?? 0) >= MAX_FAILS;
}
export async function recordFail(req: Request): Promise<void> {
  await kvIncr(failKey(req), WINDOW);
}

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export const deny = {
  auth: () => json({ error: "No autorizado" }, 401),
  origin: () => json({ error: "Origen no permitido" }, 403),
  bad: (msg = "Solicitud inválida") => json({ error: msg }, 400),
  down: () => json({ error: "Servicio no disponible, intenta de nuevo" }, 503),
};

/**
 * Guardia para rutas de admin: sesión válida, rol suficiente y, si muta, mismo origen.
 * Por defecto solo el dueño; pasar "staff" en las rutas que también usa el empleado.
 */
export function guard(req: Request, mutating: boolean, need: Role = "owner"): Response | null {
  if (mutating && !sameOrigin(req)) return deny.origin();
  const role = roleOf(req);
  if (!role) return deny.auth();
  if (need === "owner" && role !== "owner") return json({ error: "Solo el dueño puede hacer esto" }, 403);
  return null;
}

/** Igual que guard, pero además revisa que el empleado siga activo y regresa quién es. */
export async function guardActor(req: Request, mutating: boolean, need: Role = "owner"): Promise<{ blocked: Response } | { actor: { role: Role; who: string; name: string } }> {
  const b = guard(req, mutating, need);
  if (b) return { blocked: b };
  const actor = await actorOf(req).catch(() => null);
  return actor ? { actor } : { blocked: deny.auth() };
}
