import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
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

/** Acepta la contraseña del panel (huella scrypt) o la de ADMIN_PASSWORD. Ignora espacios al inicio/fin. */
export function checkPassword(raw: string): boolean {
  const given = raw.trim();
  const [salt, hex] = PANEL_HASH.split(":");
  const panelOk = timingSafeEqual(scryptSync(given, salt, 32, { N: 16384, r: 8, p: 1 }), Buffer.from(hex, "hex"));
  const p = envPass();
  const envOk = p.length >= 8 && timingSafeEqual(sha(given), sha(p)); // hash = misma longitud, sin filtrar el tamaño
  return panelOk || envOk;
}

const cookieAttrs = "Path=/api/admin; HttpOnly; Secure; SameSite=Strict";

export function sessionCookie(): string {
  const s = secret()!;
  const exp = String(Math.floor(Date.now() / 1000) + TTL);
  return `${COOKIE}=${exp}.${sign(exp, s)}; ${cookieAttrs}; Max-Age=${TTL}`;
}
export const clearCookie = `${COOKIE}=; ${cookieAttrs}; Max-Age=0`;

export function isAuthed(req: Request): boolean {
  const s = secret();
  if (!s) return false;
  const raw = (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  const [exp, mac] = (raw?.slice(COOKIE.length + 1) ?? "").split(".");
  if (!exp || !mac || Number(exp) < Date.now() / 1000) return false;
  return timingSafeEqual(sha(mac), sha(sign(exp, s)));
}

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

/** Guardia para rutas de admin: sesión válida y, si muta, mismo origen. */
export function guard(req: Request, mutating: boolean): Response | null {
  if (mutating && !sameOrigin(req)) return deny.origin();
  if (!isAuthed(req)) return deny.auth();
  return null;
}
