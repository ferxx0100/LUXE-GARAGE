// Almacén clave-valor. En Vercel: Upstash Redis (Marketplace → variables KV_REST_API_*).
// Sin esas variables: un emulador en memoria (solo para desarrollo local y pruebas).
const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const storeKind: "redis" | "memory" = URL_ && TOKEN ? "redis" : "memory";

type Arg = string | number;

async function rest(cmd: Arg[]): Promise<unknown> {
  const r = await fetch(URL_!, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(cmd),
    // Sin "no-store": así la página pública puede ser estática (ISR). Las rutas de API
    // son force-dynamic, por lo que ahí cada lectura va directo al almacén.
    signal: AbortSignal.timeout(4000),
  });
  if (!r.ok) throw new Error(`store ${r.status}`);
  const d = (await r.json()) as { result?: unknown; error?: string };
  if (d.error) throw new Error("store error");
  return d.result ?? null;
}

/* ───────── Emulador en memoria de los comandos que usamos ───────── */
type Entry = { v: string; exp?: number };
const g = globalThis as unknown as { __kv?: Map<string, Entry>; __z?: Map<string, Map<string, number>> };
const mem = () => (g.__kv ??= new Map());
const zs = () => (g.__z ??= new Map());
const live = (k: string) => {
  const e = mem().get(k);
  if (e && e.exp && e.exp <= Date.now()) { mem().delete(k); return undefined; }
  return e;
};

function memory(cmd: Arg[]): unknown {
  const [op, key, ...rest] = cmd.map(String);
  switch (op.toUpperCase()) {
    case "GET": return live(key)?.v ?? null;
    case "MGET": return [key, ...rest].map((k) => live(k)?.v ?? null);
    case "SET": {
      const [val, ...opts] = rest;
      const up = opts.map((o) => o.toUpperCase());
      const exists = !!live(key);
      if (up.includes("NX") && exists) return null;
      if (up.includes("XX") && !exists) return null;
      const ex = up.indexOf("EX");
      mem().set(key, { v: val, exp: ex >= 0 ? Date.now() + Number(opts[ex + 1]) * 1000 : undefined });
      return "OK";
    }
    case "DEL": return mem().delete(key) ? 1 : 0;
    case "INCR": {
      const e = live(key);
      const n = (e ? Number(e.v) : 0) + 1;
      mem().set(key, { v: String(n), exp: e?.exp });
      return n;
    }
    case "EXPIRE": { const e = live(key); if (!e) return 0; e.exp = Date.now() + Number(rest[0]) * 1000; return 1; }
    case "PERSIST": { const e = live(key); if (!e || !e.exp) return 0; e.exp = undefined; return 1; }
    case "ZADD": { const z = zs().get(key) ?? new Map(); z.set(rest[1], Number(rest[0])); zs().set(key, z); return 1; }
    case "ZREM": return zs().get(key)?.delete(rest[0]) ? 1 : 0;
    case "ZRANGE": return [...(zs().get(key) ?? new Map()).entries()].sort((a, b) => a[1] - b[1]).map(([m]) => m);
    default: throw new Error(`memoria: comando no soportado ${op}`);
  }
}

/** Ejecuta un comando Redis (Upstash REST o emulador en memoria). */
export async function redis<T = unknown>(...cmd: Arg[]): Promise<T> {
  return (storeKind === "redis" ? await rest(cmd) : memory(cmd)) as T;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const raw = await redis<string | null>("GET", key);
  return raw == null ? null : (JSON.parse(raw) as T);
}

export async function kvSet(key: string, value: unknown, ttlSec?: number): Promise<void> {
  const v = JSON.stringify(value);
  if (ttlSec) await redis("SET", key, v, "EX", ttlSec);
  else await redis("SET", key, v);
}

/** Contador con caducidad (para limitar intentos). */
export async function kvIncr(key: string, ttlSec: number): Promise<number> {
  const n = Number(await redis("INCR", key));
  if (n === 1) await redis("EXPIRE", key, ttlSec);
  return n;
}
