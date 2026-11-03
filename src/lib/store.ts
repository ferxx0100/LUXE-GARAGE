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

/* ───────── Celdas de agenda (10 min): todas o ninguna ─────────
 * En Upstash cada operación es un script Lua (atómico: nadie se mete a la mitad).
 * En memoria se hace lo mismo en JS (un solo hilo = también atómico). */
const LUA = {
  // Aparta por ttl: solo si todas están libres o ya son del mismo dueño.
  reserve: "for i=1,#KEYS do local v=redis.call('GET',KEYS[i]) if v and v~=ARGV[1] then return 0 end end for i=1,#KEYS do redis.call('SET',KEYS[i],ARGV[1],'EX',ARGV[2]) end return 1",
  // Fija para siempre (pago aprobado): misma regla, sin caducidad.
  claim: "for i=1,#KEYS do local v=redis.call('GET',KEYS[i]) if v and v~=ARGV[1] then return 0 end end for i=1,#KEYS do redis.call('SET',KEYS[i],ARGV[1]) end return 1",
  // Alarga el apartado (pago en revisión). No toca celdas ya fijadas ni ajenas.
  extend: "local n=0 for i=1,#KEYS do if redis.call('GET',KEYS[i])==ARGV[1] and redis.call('TTL',KEYS[i])>0 then redis.call('EXPIRE',KEYS[i],ARGV[2]) n=n+1 end end return n",
  // Libera solo las celdas de ese dueño.
  release: "local n=0 for i=1,#KEYS do if redis.call('GET',KEYS[i])==ARGV[1] then redis.call('DEL',KEYS[i]) n=n+1 end end return n",
} as const;

function memCells(op: keyof typeof LUA, keys: string[], owner: string, ttlSec?: number): number {
  const free = () => keys.every((k) => { const v = live(k)?.v; return v === undefined || v === owner; });
  const exp = ttlSec ? Date.now() + ttlSec * 1000 : undefined;
  switch (op) {
    case "reserve": case "claim":
      if (!free()) return 0;
      for (const k of keys) mem().set(k, { v: owner, exp: op === "reserve" ? exp : undefined });
      return 1;
    case "extend": return keys.filter((k) => { const e = live(k); if (e?.v !== owner || !e.exp) return false; e.exp = exp; return true; }).length;
    case "release": return keys.filter((k) => live(k)?.v === owner && mem().delete(k)).length;
  }
}

async function cells(op: keyof typeof LUA, keys: string[], owner: string, ttlSec?: number): Promise<number> {
  if (!keys.length) return 0;
  if (storeKind === "memory") return memCells(op, keys, owner, ttlSec);
  const args: Arg[] = ttlSec ? [owner, ttlSec] : [owner];
  return Number(await rest(["EVAL", LUA[op], keys.length, ...keys, ...args]));
}

/** Aparta todas las celdas por `ttlSec` (o ninguna). */
export const reserveCells = async (keys: string[], owner: string, ttlSec: number) => (await cells("reserve", keys, owner, ttlSec)) === 1;
/** Fija todas las celdas sin caducidad si están libres o son del dueño; si alguna es de otro, no cambia nada y devuelve false. */
export const claimCells = async (keys: string[], owner: string) => (await cells("claim", keys, owner)) === 1;
/** Alarga el apartado de las celdas que siguen siendo del dueño. */
export const extendCells = (keys: string[], owner: string, ttlSec: number) => cells("extend", keys, owner, ttlSec);
/** Borra solo las celdas del dueño. */
export const releaseCells = (keys: string[], owner: string) => cells("release", keys, owner);
/** Dueño de cada celda (null = libre). */
export const readCells = async (keys: string[]) => (keys.length ? await redis<(string | null)[]>("MGET", ...keys) : []);
/** ¿Todas las celdas siguen siendo de este dueño? */
export const ownsCells = async (keys: string[], owner: string) => keys.length > 0 && (await readCells(keys)).every((v) => v === owner);
