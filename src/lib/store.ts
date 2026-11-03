// Almacén clave-valor. En Vercel: Upstash Redis (Marketplace → variables KV_REST_API_*).
// Sin esas variables: memoria del proceso (solo para desarrollo local).
const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const storeKind: "redis" | "memory" = URL_ && TOKEN ? "redis" : "memory";

async function redis(cmd: (string | number)[]): Promise<unknown> {
  const r = await fetch(URL_!, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(cmd),
    // Sin "no-store": así la página pública puede ser estática (ISR). Las rutas de API
    // son force-dynamic, por lo que ahí cada lectura va directo al almacén.
    signal: AbortSignal.timeout(3000),
  });
  if (!r.ok) throw new Error(`store ${r.status}`);
  const d = (await r.json()) as { result?: unknown; error?: string };
  if (d.error) throw new Error("store error");
  return d.result;
}

type Entry = { v: string; exp?: number };
const g = globalThis as unknown as { __kv?: Map<string, Entry> };
const mem = () => (g.__kv ??= new Map());
const alive = (e?: Entry) => (e && (!e.exp || e.exp > Date.now()) ? e : undefined);

export async function kvGet<T>(key: string): Promise<T | null> {
  const raw = storeKind === "redis" ? await redis(["GET", key]) : alive(mem().get(key))?.v;
  return raw == null ? null : (JSON.parse(String(raw)) as T);
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const v = JSON.stringify(value);
  if (storeKind === "redis") await redis(["SET", key, v]);
  else mem().set(key, { v });
}

/** Contador con caducidad (para limitar intentos). */
export async function kvIncr(key: string, ttlSec: number): Promise<number> {
  if (storeKind === "redis") {
    const n = Number(await redis(["INCR", key]));
    if (n === 1) await redis(["EXPIRE", key, ttlSec]);
    return n;
  }
  const e = alive(mem().get(key));
  const n = (e ? Number(e.v) : 0) + 1;
  mem().set(key, { v: String(n), exp: e?.exp ?? Date.now() + ttlSec * 1000 });
  return n;
}
