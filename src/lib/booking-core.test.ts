import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  addDays, blocksFromCells, candidateStarts, cellsFor, checkWashes, dayWindow, estimateFreeAt, fits, fmtRange, fmtTime, fromMin,
  hoursText, isDateStr, isOpenAt, localNow, maskName, maskPhone, membershipCode, nextFree, nextOpening, normalizeCode, priceFor,
  addMonths, canChange, chargedMonths, memberBookingError, memberStatusFrom, periodFromCharges, memberCode, memberValid, minutesUntil, nipError, normalizePhone, rangeShort,
  bookingTicket, capFirst, checkoutPreference, paymentDecision, sealFor, sealSecondsLeft, sealWindow, SERVICE_MIN, serviceText, shortCode, spotLabel, toMin, verifyMpSignature,
} from "./booking-core.ts";

const prices = { carro: 149, camioneta: 199, suv: 249 };
// Horario real: lun–jue 12–19, vie–sáb 13–18, domingo cerrado.
const L = { open: 12, close: 19 }, V = { open: 13, close: 18 };
const hours = [null, L, L, L, L, V, V];
const MON = "2026-11-02", TUE = "2026-11-03", FRI = "2026-11-06", SUN = "2026-11-01";
const hm = (t: string) => toMin(t);
const times = (xs: number[]) => xs.map(fromMin);

test("precio: lo calcula el servidor con domicilio +100", () => {
  assert.equal(priceFor(prices, "carro"), 149);
  assert.equal(priceFor(prices, "camioneta"), 199);
  assert.equal(priceFor(prices, "suv"), 249);
});

test("ventana del día: lunes 12–19, viernes 13–18, domingo cerrado, fecha inválida", () => {
  assert.deepEqual(dayWindow(hours, MON), { open: 720, close: 1140 });
  assert.deepEqual(dayWindow(hours, FRI), { open: 780, close: 1080 });
  assert.equal(dayWindow(hours, SUN), null);
  assert.equal(dayWindow(hours, "2026-02-30"), null);
  assert.equal(isDateStr("2026-13-01"), false);
});

test("rejilla: completo cada 30 min, exterior cada 20, sin pasarse del cierre", () => {
  const c = times(candidateStarts(hours, FRI, SERVICE_MIN.completo, []));
  assert.equal(c[0], "13:00"); assert.equal(c[1], "13:30"); assert.equal(c.at(-1), "17:30"); assert.equal(c.length, 10);
  const e = times(candidateStarts(hours, FRI, SERVICE_MIN.exterior, []));
  assert.equal(e[1], "13:30"); assert.equal(e.at(-1), "17:30"); assert.equal(e.length, 10); // cada 30 min
  assert.equal(fits(hours, FRI, hm("17:40"), 30, []), false); // terminaría 18:10
  assert.equal(fits(hours, FRI, hm("17:30"), 30, []), true);
  assert.deepEqual(candidateStarts(hours, SUN, 30, []), []);
});

test("traslapes: una sola fosa", () => {
  const blocks = [{ start: hm("14:00"), end: hm("14:30") }];
  assert.equal(fits(hours, MON, hm("13:40"), 30, blocks), false);
  assert.equal(fits(hours, MON, hm("14:20"), 20, blocks), false);
  assert.equal(fits(hours, MON, hm("13:30"), 30, blocks), true); // termina justo cuando empieza
  assert.equal(fits(hours, MON, hm("14:30"), 20, blocks), true);
  assert.equal(fits(hours, MON, hm("14:03"), 20, []), false); // fuera de la rejilla de 5
  assert.equal(fits(hours, MON, hm("14:35"), 20, blocks), true); // la rejilla de 5 permite 14:35
});

test("pegar citas: se ofrece la hora en que termina un bloque", () => {
  const blocks = [{ start: hm("12:00"), end: hm("12:20") }]; // un exterior a las 12
  const c = times(candidateStarts(hours, MON, 30, blocks));
  assert.equal(c[0], "12:20"); // pegado al exterior
  assert.ok(!c.includes("12:00"));
  assert.ok(c.includes("12:30")); // la rejilla normal sigue
  assert.ok(c.includes("13:00"));
});

test("hoy: libre = unos 5 min después de ahora; ocupado = 5 min después de que se desocupa", () => {
  const now = { date: MON, minutes: hm("15:07") };
  assert.equal(nextFree(hours, MON, 20, [], now), hm("15:15")); // 15:07 + 4 → 15:15, no 15:20 ni 15:30
  assert.equal(nextFree(hours, MON, 30, [], { date: MON, minutes: hm("16:41") }), hm("16:45")); // a las 4:41, 4:45
  assert.equal(fits(hours, MON, hm("15:10"), 20, [], now), false);
  assert.equal(nextFree(hours, MON, 30, [], now, hm("15:45")), hm("15:50"));
  const c = times(candidateStarts(hours, MON, 30, [], now, hm("15:45")));
  assert.equal(c[0], "15:50"); assert.ok(c.includes("16:00"));
  assert.equal(fits(hours, "2026-10-30", hm("13:00"), 30, [], now), false); // pasado
  assert.equal(nextFree(hours, MON, 30, [], { date: MON, minutes: hm("18:50") }), null); // ya no cabe
  assert.equal(nextFree(hours, TUE, 30, [], now, hm("15:45")), hm("12:00")); // busyUntil solo cuenta hoy
});

test("celdas de 5 min y bloques", () => {
  assert.deepEqual(cellsFor(MON, hm("16:00"), 30), ["1600", "1605", "1610", "1615", "1620", "1625"].map((t) => `lg:cell:2026-11-02:${t}`));
  assert.equal(cellsFor(MON, hm("16:00"), 20).length, 4);
  const cells = [720, 725, 730, 735, 740].map((start, i) => ({ start, owner: ["a", "a", "b", "b", null][i] }));
  assert.deepEqual(blocksFromCells(cells), [{ start: 720, end: 730 }, { start: 730, end: 740 }]);
});

test("membresía: 4 lavadas completas en días distintos, dentro del mes y que quepan", () => {
  const now = { date: MON, minutes: hm("15:00") };
  const ok = ["2026-11-03", "2026-11-04", "2026-11-12", "2026-11-28"].map((date) => ({ date, time: "13:00" }));
  const base = { hours, dur: SERVICE_MIN.completo, count: 4, now, blocksByDate: {} };
  assert.equal(checkWashes({ ...base, washes: ok }), null);
  assert.match(checkWashes({ ...base, washes: ok.slice(0, 3) })!, /4 lavadas/);
  assert.match(checkWashes({ ...base, washes: [...ok, { date: "2026-11-05", time: "13:00" }] })!, /4 lavadas/); // ni una de más
  assert.match(checkWashes({ ...base, washes: [...ok.slice(0, 3), { date: "2026-11-03", time: "15:00" }] })!, /distinto/);
  assert.match(checkWashes({ ...base, washes: [...ok.slice(0, 3), { date: SUN, time: "13:00" }] })!, /mes/);
  assert.match(checkWashes({ ...base, washes: [...ok.slice(0, 3), { date: addDays(MON, 31), time: "13:00" }] })!, /mes/);
  // El turno de 30 min se traslapa con una cita que ya existe (13:20–13:40) → no cabe.
  assert.match(checkWashes({ ...base, washes: ok, blocksByDate: { "2026-11-04": [{ start: hm("13:20"), end: hm("13:40") }] } })!, /miércoles 4/);
  // Pegado justo después de otra cita sí cabe.
  assert.equal(checkWashes({ ...base, washes: ok, blocksByDate: { "2026-11-04": [{ start: hm("12:30"), end: hm("13:00") }] } }), null);
});

test("servicio: la lavada de membresía no se liga a un auto", () => {
  assert.equal(serviceText({ kind: "completo" }), "Exterior e interior");
  assert.equal(serviceText({ kind: "completo", vehicle: "camioneta", plate: "AAA-000-A" }), "Exterior e interior · Camioneta · AAA-000-A");
  assert.equal(serviceText({ kind: "exterior", vehicle: "carro", plate: "" }), "Solo exterior · Carro");
  assert.equal(serviceText({ kind: "completo", vehicle: "suv", service: "detallado" }), "Detallado premium · SUV o pick up");
});

test("Mercado Pago: preferencia con monto del servidor y decisión solo con lo que dice la API", () => {
  const exp = new Date("2026-11-03T18:15:00Z");
  const p = checkoutPreference({ id: "abcdefghijklmnopqrstuv", code: "LG-ABC234", amount: 180, title: "LUXE GARAGE · Lavado", returnUrl: "https://luxegaragee.com/reserva/abcdefghijklmnopqrstuv", expiresAt: exp }, "https://luxegaragee.com");
  assert.equal(p.items[0].unit_price, 180);
  assert.equal(p.items[0].currency_id, "MXN");
  assert.equal(p.external_reference, "abcdefghijklmnopqrstuv");
  assert.equal(p.notification_url, "https://luxegaragee.com/api/mp/webhook");
  assert.equal(p.binary_mode, true);
  assert.equal(p.expiration_date_to, "2026-11-03T18:15:00.000+00:00");
  assert.deepEqual(p.payment_methods.excluded_payment_types.map((x) => x.id), ["ticket", "atm", "bank_transfer"]);
  assert.equal(p.back_urls.failure, p.back_urls.success);

  const t = { id: "abcdefghijklmnopqrstuv", amount: 180 };
  assert.equal(paymentDecision({ status: "approved", external_reference: t.id, transaction_amount: 180 }, t), "confirm");
  assert.equal(paymentDecision({ status: "approved", external_reference: t.id, transaction_amount: 1 }, t), "mismatch"); // monto alterado
  assert.equal(paymentDecision({ status: "approved", external_reference: "otra-reserva", transaction_amount: 180 }, t), "ignore"); // pago de otra cosa
  assert.equal(paymentDecision({ status: "in_process", external_reference: t.id, transaction_amount: 180 }, t), "pending");
  assert.equal(paymentDecision({ status: "rejected", external_reference: t.id, transaction_amount: 180 }, t), "ignore");
  assert.equal(paymentDecision({ status: "approved", external_reference: t.id, transaction_amount: 180 }, null), "ignore");
});

test("ticket para el celular: sin teléfono ni correo, nombre abreviado", () => {
  const b = { code: "LG-ABC234", date: "2026-11-04", time: "12:30", duration: 30, kind: "completo", vehicle: "carro", place: "garage", amount: 180, name: "Juan Prueba López", phone: "5500000000", email: "prueba@example.com" };
  const t = bookingTicket(b, "Las Palomas, Zamora, Michoacán");
  assert.equal(t.code, "LG-ABC234");
  assert.deepEqual(t.rows.map((r) => r.value), ["Miércoles 4 de noviembre", "12:30 pm – 1:00 pm", "Exterior e interior · Carro", "Las Palomas, Zamora, Michoacán", "Juan P. L."]);
  assert.equal(t.total, "$180 pagado");
  const text = JSON.stringify(t);
  assert.ok(!text.includes("5500000000") && !text.includes("example.com") && !text.includes("Prueba"));
  assert.equal(bookingTicket({ ...b, place: "domicilio" }, "x").rows[3].value, "A domicilio"); // nunca la dirección
  assert.match(bookingTicket({ ...b, membershipCode: "LG-MABCDE" }, "x").total, /membresía LG-MABCDE/);

  assert.equal(capFirst("martes 3 de noviembre"), "Martes 3 de noviembre");
});

test("abierto ahora, próxima apertura, textos y etiquetas", () => {
  assert.equal(isOpenAt(hours, MON, 12 * 60), true);
  assert.equal(isOpenAt(hours, MON, 19 * 60), false);
  assert.deepEqual(nextOpening(hours, { date: TUE, minutes: 106 }), { label: "hoy a las 12 pm", inMinutes: 12 * 60 - 106 });
  assert.equal(nextOpening(hours, { date: "2026-11-05", minutes: 20 * 60 })!.label, "mañana viernes a la 1 pm");
  assert.equal(nextOpening(hours, { date: "2026-11-07", minutes: 20 * 60 })!.label, "el lunes a las 12 pm");
  assert.equal(nextOpening(hours, { date: TUE, minutes: 100 }, true)!.label, "mañana miércoles a las 12 pm");
  assert.equal(hoursText(hours), "Lunes a jueves de 12 pm a 7 pm · Viernes y sábado de 1 pm a 6 pm");
  assert.equal(fmtTime("13:00"), "1 pm");
  assert.equal(fmtTime("12:30"), "12:30 pm");
  assert.equal(fmtRange("16:00", 30), "4:00 pm – 4:30 pm");
  assert.equal(spotLabel(TUE, "16:30", { date: TUE }), "hoy 4:30 pm");
  assert.equal(spotLabel("2026-11-04", "12:00", { date: TUE }), "mañana miércoles 12 pm");
  assert.equal(spotLabel(FRI, "13:00", { date: TUE }), "el viernes 1 pm");
});

test("fosa ocupada: hora estimada en que se desocupa", () => {
  const now = { date: MON, minutes: hm("15:10") };
  assert.equal(estimateFreeAt({ date: MON, minutes: hm("15:00") }, 30, now), hm("15:30"));
  assert.equal(estimateFreeAt({ date: MON, minutes: hm("14:30") }, 30, now), hm("15:10")); // pasó hace 10 min: "terminando"
  assert.equal(estimateFreeAt({ date: MON, minutes: hm("14:00") }, 30, now), null); // pasó hace >20 min: se libera solo
  assert.equal(estimateFreeAt({ date: "2026-10-31", minutes: hm("18:00") }, 30, now), null); // otro día
  assert.equal(estimateFreeAt(null, 30, now), hm("15:15"));
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

test("sello vivo: 3 dígitos, cambia con la ventana, depende de la llave y del dueño", () => {
  const w = sealWindow(Date.UTC(2026, 10, 3, 18, 0, 5));
  const s = sealFor("llave-de-prueba", "abc", w);
  assert.match(s, /^\d{3}$/);
  assert.equal(sealFor("llave-de-prueba", "abc", w), s); // estable dentro de la ventana
  assert.equal(sealWindow(Date.UTC(2026, 10, 3, 18, 0, 29)), w);
  assert.equal(sealWindow(Date.UTC(2026, 10, 3, 18, 0, 30)), w + 1);
  assert.equal(sealSecondsLeft(Date.UTC(2026, 10, 3, 18, 0, 5)), 25);
  const many = new Set(Array.from({ length: 40 }, (_, i) => sealFor("llave-de-prueba", "abc", w + i)));
  assert.ok(many.size > 25); // cambia de verdad
  const others = Array.from({ length: 20 }, (_, i) => sealFor("otra-llave", "abc", w + i) === sealFor("llave-de-prueba", "abc", w + i)).filter(Boolean).length;
  assert.ok(others < 5);
});

test("códigos y máscaras", () => {
  assert.match(shortCode("abcdefghijklmnopqrstuv"), /^LG-[A-Z2-9]{6}$/);
  assert.match(membershipCode("abcdefghijklmnopqrstuv"), /^LG-M[A-Z2-9]{5}$/);
  assert.equal(normalizeCode(" lg m4k 2p9"), "LG-M4K2P9");
  assert.equal(normalizeCode("LG-ABC234"), "LG-ABC234");
  assert.equal(normalizeCode("abc234"), "LG-ABC234");
  assert.equal(normalizeCode("LG-AB"), null);
  assert.equal(maskPhone("55 0000 0000"), "55****0000");
  assert.equal(maskName("Juan Prueba López"), "Juan P. L.");
});

test("socios: mes pagado, 4 lavadas, cambios solo con más de 72 h", () => {
  assert.equal(addMonths("2026-11-04", 1), "2026-12-04");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-12-15", 1), "2027-01-15");

  const m = { status: "active" as const, periodStart: "2026-11-04", periodEnd: "2026-12-04", perPeriod: 4, used: 0 };
  assert.equal(memberValid(m, "2026-11-04"), true);
  assert.equal(memberValid(m, "2026-12-04"), false); // el día que vence ya no
  assert.equal(memberValid({ ...m, status: "pending" }, "2026-11-10"), false); // sin pagar
  assert.equal(memberValid({ ...m, status: "cancelled" }, "2026-11-10"), true); // canceló, pero su mes ya está pagado
  assert.equal(memberValid({ ...m, status: "expired" }, "2026-11-10"), false);

  assert.equal(memberBookingError(m, "2026-11-20", "2026-11-04"), null);
  assert.match(memberBookingError(m, "2026-12-04", "2026-11-04")!, /termina el jueves 3 de diciembre/); // fuera de su mes
  assert.match(memberBookingError(m, "2026-11-03", "2026-11-04")!, /hoy en adelante/);
  assert.match(memberBookingError({ ...m, used: 4 }, "2026-11-20", "2026-11-04")!, /4 lavadas/); // la quinta no
  assert.match(memberBookingError({ ...m, periodEnd: "2026-11-04" }, "2026-11-20", "2026-12-10")!, /no está vigente/); // no pagó el segundo mes

  const now = { date: "2026-11-04", minutes: toMin("12:00") };
  assert.equal(minutesUntil("2026-11-07", "12:00", now), 72 * 60);
  assert.equal(canChange("2026-11-07", "12:00", now), false); // justo 72 h: ya no
  assert.equal(canChange("2026-11-07", "12:10", now), true);
  assert.equal(canChange("2026-11-05", "16:00", now), false);
});

test("socios: celular, NIP y código", () => {
  assert.equal(normalizePhone("55 0000 0000"), "5500000000");
  assert.equal(normalizePhone("+52 1 55 0000 0000"), "5500000000");
  assert.equal(normalizePhone("+52 55-0000-0000"), "5500000000");
  assert.equal(normalizePhone("550000"), null);
  assert.equal(nipError("4826"), null);
  assert.match(nipError("12a4")!, /4 números/);
  assert.match(nipError("0000")!, /fácil/);
  assert.match(nipError("1234")!, /fácil/);
  assert.match(memberCode("abcdefghijklmnopqrstuv"), /^LG-S[A-Z2-9]{5}$/);
  assert.equal(rangeShort("16:00", 30), "4:00–4:30");
  assert.equal(rangeShort("12:30", 30), "12:30–1:00");
});

test("cobro automático: solo se usa lo que Mercado Pago ya cobró", () => {
  assert.equal(chargedMonths({ summarized: { charged_quantity: 2 } }), 2);
  assert.equal(chargedMonths({ summarized: null }), null);
  assert.equal(chargedMonths({}), null);
  assert.equal(periodFromCharges("2026-11-04", 0), null); // autorizó la tarjeta pero aún no se cobra
  assert.deepEqual(periodFromCharges("2026-11-04", 1), { periodStart: "2026-11-04", periodEnd: "2026-12-04" });
  assert.deepEqual(periodFromCharges("2026-11-04", 2), { periodStart: "2026-12-04", periodEnd: "2027-01-04" });
  assert.equal(memberStatusFrom("authorized", 0), "pending");
  assert.equal(memberStatusFrom("authorized", 1), "active");
  assert.equal(memberStatusFrom("paused", 1), "cancelled"); // falló el cobro: no se renueva, usa lo pagado
  assert.equal(memberStatusFrom("cancelled", 2), "cancelled");
  // No pagó el segundo mes: su mes 1 termina y ya no está vigente aunque la cuenta exista.
  const p = periodFromCharges("2026-11-04", 1)!;
  assert.equal(memberValid({ status: "cancelled", ...p }, "2026-12-05"), false);
});
