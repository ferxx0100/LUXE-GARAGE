// El motivo de un fallo de Mercado Pago va a los logs SIN llaves, correos ni números largos (regla B11).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mpReason } from "./logsafe.ts";

const mpError = (status: number, msg: string) => Object.assign(new Error(msg), { name: "MpError", status });

test("logs de pago: sin llave, correo ni números largos", () => {
  // Llave inventada, armada en partes para que no parezca una real.
  const fake = [["APP", "USR"].join("_"), "0".repeat(16), "0".repeat(6), "ab".repeat(16), "0".repeat(9)].join("-");
  const out = mpReason(new TypeError(`Headers.append: "Bearer ${fake}\n" is an invalid header value.`));
  assert.ok(out.startsWith("TypeError:"));
  assert.ok(!out.includes(fake.slice(0, 8)), out);
  assert.ok(!/\d{6,}/.test(out), out);
  assert.equal(mpReason(mpError(401, "invalid access token")), "MP 401: invalid access token");
  assert.ok(!mpReason(new Error("payer prueba@example.com 5500000000")).includes("@"));
});
