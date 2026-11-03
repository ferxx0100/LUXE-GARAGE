import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { addDays, canBook, fmtTime, hoursText, isDateStr, isOpenAt, localNow, maskName, maskPhone, nextOpening, priceFor, shortCode, slotsFor, verifyMpSignature } from "./booking-core.ts";

const prices = { carro: 180, camioneta: 220, domicilio: 100, suscripcion: 555 };
// Horario real: lun–jue 12–19, vie–sáb 13–18, domingo cerrado.
const L = { open: 12, close: 19 }, V = { open: 13, close: 18 };
const hours = [null, L, L, L, L, V, V];

test("precio: lo calcula el servidor con domicilio +100", () => {
  assert.equal(priceFor(prices, "carro", "garage"), 180);
  assert.equal(priceFor(prices, "camioneta", "garage"), 220);
  assert.equal(priceFor(prices, "carro", "domicilio"), 280);
  assert.equal(priceFor(prices, "camioneta", "domicilio"), 320);
});

test("horarios: lunes 12–6 pm, viernes 1–5 pm, domingo cerrado, fecha inválida vacía", () => {
  assert.deepEqual(slotsFor(hours, "2026-11-02"), ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]); // lunes
  assert.deepEqual(slotsFor(hours, "2026-11-06"), ["13:00", "14:00", "15:00", "16:00", "17:00"]); // viernes
  assert.deepEqual(slotsFor(hours, "2026-11-01"), []); // domingo
  assert.deepEqual(slotsFor(hours, "2026-02-30"), []);
  assert.equal(isDateStr("2026-13-01"), false);
});

test("canBook: no pasado, no fuera de horario, 30 min de anticipación, máx. 30 días", () => {
  const now = { date: "2026-11-02", minutes: 13 * 60 + 40 }; // lunes 1:40 pm
  assert.equal(canBook(hours, "2026-11-02", "13:00", now), false); // ya pasó
  assert.equal(canBook(hours, "2026-11-02", "14:00", now), false); // menos de 30 min
  assert.equal(canBook(hours, "2026-11-02", "15:00", now), true);
  assert.equal(canBook(hours, "2026-11-02", "19:00", now), false); // fuera de horario
  assert.equal(canBook(hours, "2026-11-06", "18:00", now), false); // viernes cierra a las 6
  assert.equal(canBook(hours, "2026-11-01", "12:00", now), false); // ayer/domingo
  assert.equal(canBook(hours, addDays("2026-11-02", 31), "12:00", now), false);
  assert.equal(canBook(hours, "2026-11-03", "12:00", now), true);
});

test("abierto ahora, próxima apertura y texto del horario", () => {
  assert.equal(isOpenAt(hours, "2026-11-02", 12 * 60), true);
  assert.equal(isOpenAt(hours, "2026-11-02", 19 * 60), false);
  assert.equal(isOpenAt(hours, "2026-11-07", 13 * 60 + 30), true); // sábado
  assert.deepEqual(nextOpening(hours, { date: "2026-11-03", minutes: 106 }), { label: "hoy a las 12 pm", inMinutes: 12 * 60 - 106 }); // martes 1:46 am
  assert.equal(nextOpening(hours, { date: "2026-11-03", minutes: 20 * 60 })!.label, "mañana miércoles a las 12 pm");
  assert.equal(nextOpening(hours, { date: "2026-11-05", minutes: 20 * 60 })!.label, "mañana viernes a la 1 pm");
  assert.equal(nextOpening(hours, { date: "2026-11-07", minutes: 20 * 60 })!.label, "el lunes a las 12 pm"); // sábado noche
  assert.equal(nextOpening(hours, { date: "2026-11-03", minutes: 100 }, true)!.label, "mañana miércoles a las 12 pm"); // cerrado a mano hoy
  assert.equal(hoursText(hours), "Lunes a jueves de 12 pm a 7 pm · Viernes y sábado de 1 pm a 6 pm");
  assert.equal(fmtTime("13:00"), "1 pm");
  assert.equal(fmtTime("12:30"), "12:30 pm");
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
