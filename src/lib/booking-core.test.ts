import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { addDays, canBook, isDateStr, localNow, maskName, maskPhone, priceFor, shortCode, slotsFor, verifyMpSignature } from "./booking-core.ts";

const prices = { carro: 180, camioneta: 220, domicilio: 100, suscripcion: 555 };
const hours = { open: 9, close: 19, days: [1, 2, 3, 4, 5, 6] };

test("precio: lo calcula el servidor con domicilio +100", () => {
  assert.equal(priceFor(prices, "carro", "garage"), 180);
  assert.equal(priceFor(prices, "camioneta", "garage"), 220);
  assert.equal(priceFor(prices, "carro", "domicilio"), 280);
  assert.equal(priceFor(prices, "camioneta", "domicilio"), 320);
});

test("horarios: lunes 9–18, domingo cerrado, fecha inválida vacía", () => {
  const lunes = "2026-11-02"; // lunes
  assert.deepEqual(slotsFor(hours, lunes), ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]);
  assert.deepEqual(slotsFor(hours, "2026-11-01"), []); // domingo
  assert.deepEqual(slotsFor(hours, "2026-02-30"), []);
  assert.equal(isDateStr("2026-13-01"), false);
});

test("canBook: no pasado, no fuera de horario, 30 min de anticipación, máx. 30 días", () => {
  const now = { date: "2026-11-02", minutes: 10 * 60 + 40 }; // lunes 10:40
  assert.equal(canBook(hours, "2026-11-02", "10:00", now), false); // ya pasó
  assert.equal(canBook(hours, "2026-11-02", "11:00", now), false); // menos de 30 min
  assert.equal(canBook(hours, "2026-11-02", "12:00", now), true);
  assert.equal(canBook(hours, "2026-11-02", "19:00", now), false); // fuera de horario
  assert.equal(canBook(hours, "2026-11-01", "12:00", now), false); // ayer
  assert.equal(canBook(hours, addDays("2026-11-02", 31), "12:00", now), false);
  assert.equal(canBook(hours, "2026-11-03", "09:00", now), true);
});

test("localNow da fecha de México", () => {
  const n = localNow(new Date("2026-11-03T05:30:00Z")); // 23:30 del día 2 en CDMX
  assert.equal(n.date, "2026-11-02");
  assert.equal(n.minutes, 23 * 60 + 30);
});

test("firma de webhook de Mercado Pago", () => {
  const secret = "secreto-de-prueba";
  const ts = "1704908010", reqId = "req-123", dataId = "123456";
  const v1 = createHmac("sha256", secret).update(`id:${dataId};request-id:${reqId};ts:${ts};`).digest("hex");
  assert.equal(verifyMpSignature(`ts=${ts},v1=${v1}`, reqId, dataId, secret), true);
  assert.equal(verifyMpSignature(`ts=${ts},v1=${v1}`, reqId, "999", secret), false);
  assert.equal(verifyMpSignature(`ts=${ts},v1=${v1}`, reqId, dataId, "otro"), false);
  assert.equal(verifyMpSignature(null, reqId, dataId, secret), false);
  assert.equal(verifyMpSignature("ts=1,v1=zz", reqId, dataId, secret), false);
});

test("código corto y máscaras", () => {
  assert.match(shortCode("abcdefghijklmnopqrstuv"), /^LG-[A-Z2-9]{6}$/);
  assert.equal(maskPhone("55 0000 0000"), "55****0000");
  assert.equal(maskName("Juan Prueba López"), "Juan P. L.");
});
