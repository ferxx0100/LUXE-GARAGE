import { test } from "node:test";
import assert from "node:assert/strict";

// Siempre en memoria: nunca tocar un Upstash real desde las pruebas.
for (const k of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) delete process.env[k];
const { claimCells, extendCells, ownsCells, readCells, releaseCells, reserveCells, storeKind } = await import("./store.ts");

const A = ["lg:cell:2026-11-02:1600", "lg:cell:2026-11-02:1610", "lg:cell:2026-11-02:1620"];
const B = ["lg:cell:2026-11-02:1620", "lg:cell:2026-11-02:1630"]; // se traslapa en 16:20

test("celdas: todas o ninguna, sin vender dos veces la misma hora", async () => {
  assert.equal(storeKind, "memory");
  assert.equal(await reserveCells(A, "res-a", 900), true);
  assert.equal(await reserveCells(B, "res-b", 900), false); // choca en 16:20
  assert.deepEqual(await readCells(["lg:cell:2026-11-02:1630"]), [null]); // no dejó nada a medias
  assert.equal(await ownsCells(A, "res-a"), true);
  assert.equal(await claimCells(B, "res-b"), false); // tampoco al fijar
  assert.equal(await claimCells(A, "res-a"), true); // pago aprobado: permanente
  assert.equal(await extendCells(A, "res-a", 60), 0); // ya fijadas: no vuelven a caducar
  assert.equal(await releaseCells(A, "otro"), 0); // solo el dueño libera
  assert.equal(await releaseCells(A, "res-a"), 3);
  assert.equal(await reserveCells(B, "res-b", 900), true);
  assert.equal(await extendCells(B, "res-b", 7200), 2);
});

test("celdas: el apartado caduca solo", async () => {
  const K = ["lg:cell:2026-11-03:1200"];
  assert.equal(await reserveCells(K, "x", 1), true);
  await new Promise((r) => setTimeout(r, 1100));
  assert.equal(await reserveCells(K, "y", 900), true);
});
