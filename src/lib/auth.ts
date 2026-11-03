import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { kvIncr } from "./store";

const COOKIE = "lg_admin";
const TTL = 60 * 60 * 12; // 12 h
const MAX_ATTEMPTS = 5;
const WINDOW = 15 * 60;

const sha = (s: string) => createHash("sha256").update(s).digest();

function secret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}
const sign = (payload: string, s: string) => createHmac("sha256", s).update(payload).digest("base64url");

export function adminConfigured(): boolean {
  return !!secret() && (process.env.ADMIN_PASSWORD ?? "").length >= 12;
}

export function checkPassword(given: string): boolean {
  const p = process.env.ADMIN_PASSWORD ?? "";
  if (p.length < 12) return false;
  return timingSafeEqual(sha(given), sha(p)); // hash = misma longitud, sin filtrar el tamaño
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

export async function tooManyAttempts(req: Request): Promise<boolean> {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  return (await kvIncr(`lg:rl:login:${ip}`, WINDOW)) > MAX_ATTEMPTS;
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
