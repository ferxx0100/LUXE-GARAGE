import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { addDays, blocksFromCells, CELL, cellsFor, checkWashes, isDateStr, isTimeStr, membershipCode, SERVICE_MIN, shortCode, toMin, type Block, type Kind, type Vehicle } from "./booking-core";
import { DateStr, Email, getBookings, HOLD_SEC, indexCode, isBookingId, Name, PENDING_SEC, Phone, Plate, saveIndexed, TimeStr, todayCtx, type Booking } from "./bookings";
import { sendMembershipConfirmed } from "./mail";
import { claimCells, extendCells, kvGet, kvSet, ownsCells, readCells, redis, reserveCells } from "./store";

// Membresía: pago único por 6 lavadas dentro de 30 días. Las fechas y horas se eligen AL COMPRAR
// y apartan su lugar en la agenda igual que una reserva (una sola fosa, sin traslapes).
export const VALID_DAYS = 30;

export const MembershipInput = z.object({
  kind: z.enum(["completo", "exterior"]),
  vehicle: z.enum(["carro", "camioneta"]),
  name: Name,
  phone: Phone,
  email: Email,
  plate: Plate,
  washes: z.array(z.object({ date: DateStr, time: TimeStr })).min(1).max(31),
});

export type MembershipStatus = "hold" | "pending" | "confirmed" | "cancelled" | "conflict";
export interface Membership {
  id: string; code: string; status: MembershipStatus;
  kind: Kind; vehicle: Vehicle; duration: number;
  name: string; phone: string; email: string; plate: string;
  washes: { date: string; time: string }[]; bookingIds: string[];
  amount: number; validFrom: string; validTo: string;
  paymentId?: string; paymentStatus?: string; paidAt?: string;
  createdAt: string; updatedAt: string;
}

const mk = (id: string) => `lg:mb:${id}`;
const washCells = (m: Pick<Membership, "washes" | "duration">) => m.washes.flatMap((w) => cellsFor(w.date, toMin(w.time), m.duration));
/** Id de cada lavada: derivado del id secreto de la membresía (idempotente y no adivinable). */
const washId = (mid: string, i: number) => createHash("sha256").update(`lg-wash|${mid}|${i}`).digest("base64url").slice(0, 22);

type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

/** Valida las 6 lavadas y aparta TODAS sus celdas por 15 min (o ninguna). */
export async function createMembershipHold(input: z.infer<typeof MembershipInput>): Promise<Result<Membership>> {
  const c = await todayCtx();
  const duration = SERVICE_MIN[input.kind];
  const washes = [...input.washes].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  // Lee solo las celdas de esas lavadas para decir exactamente cuál ya se ocupó.
  const keysPer = washes.map((w) => (isDateStr(w.date) && isTimeStr(w.time) ? cellsFor(w.date, toMin(w.time), duration) : []));
  const owners = await readCells(keysPer.flat());
  const blocksByDate: Record<string, Block[]> = {};
  let k = 0;
  washes.forEach((w, i) => {
    const cells = keysPer[i].map((_, j) => ({ start: toMin(w.time) + j * CELL, owner: owners[k++] ?? null }));
    blocksByDate[w.date] = blocksFromCells(cells);
  });
  const err = checkWashes({
    hours: c.s.hours, washes, dur: duration, count: c.s.subscriptionWashes, now: c.now,
    blocksByDate, busyUntilMin: c.busyMin, closedToday: c.closed, maxDays: VALID_DAYS,
  });
  if (err) return { ok: false, status: /ya no está/.test(err) ? 409 : 400, error: err };

  const id = randomBytes(16).toString("base64url");
  if (!(await reserveCells(keysPer.flat(), id, HOLD_SEC))) return { ok: false, status: 409, error: "Alguien acaba de apartar una de tus horas. Elige otra." };
  const now = new Date().toISOString();
  const m: Membership = {
    id, code: membershipCode(id), status: "hold", kind: input.kind, vehicle: input.vehicle, duration,
    name: input.name, phone: input.phone, email: input.email, plate: input.plate,
    washes, bookingIds: [], amount: c.s.prices.suscripcion,
    validFrom: c.now.date, validTo: addDays(c.now.date, VALID_DAYS), createdAt: now, updatedAt: now,
  };
  await kvSet(mk(id), m, 2 * 24 * 3600); // si nunca se paga, se borra sola
  return { ok: true, value: m };
}

export async function getMembership(id: string): Promise<Membership | null> {
  return isBookingId(id) ? kvGet<Membership>(mk(id)) : null;
}

export const membershipHoldValid = (m: Membership) => ownsCells(washCells(m), m.id);

/** Las lavadas (Booking) de una membresía ya pagada, en orden. */
export const membershipBookings = (m: Membership) => getBookings(m.bookingIds);

export async function setMembershipEmail(id: string, email: string): Promise<void> {
  const m = await getMembership(id);
  if (!m || m.email === email) return;
  await kvSet(mk(id), { ...m, email, updatedAt: new Date().toISOString() }, m.status === "hold" ? 2 * 24 * 3600 : undefined);
}

/** Pago aprobado → fija las celdas de las 6 lavadas y crea sus reservas (idempotente). */
export async function confirmMembership(id: string, paymentId: string): Promise<Membership | null> {
  const m = await getMembership(id);
  if (!m) return null;
  if (m.status === "confirmed") return m;
  const now = new Date().toISOString();
  const paid = { paymentId, paymentStatus: "approved", paidAt: now, updatedAt: now };
  if (!(await claimCells(washCells(m), m.id))) {
    const next: Membership = { ...m, ...paid, status: "conflict" };
    await kvSet(mk(id), next);
    await indexCode(m.code, `m:${id}`);
    return next;
  }
  const bookingIds = m.washes.map((_, i) => washId(m.id, i));
  await Promise.all(m.washes.map((w, i) => {
    const b: Booking = {
      id: bookingIds[i], code: shortCode(bookingIds[i]), status: "confirmed",
      date: w.date, time: w.time, duration: m.duration, vehicle: m.vehicle, kind: m.kind, place: "garage", address: "",
      name: m.name, phone: m.phone, email: m.email, plate: m.plate, notes: `Membresía ${m.code} · lavada ${i + 1} de ${m.washes.length}`,
      amount: 0, owner: m.id, membershipId: m.id, membershipCode: m.code, ...paid, createdAt: now,
    };
    return saveIndexed(b);
  }));
  const next: Membership = { ...m, ...paid, status: "confirmed", bookingIds };
  await kvSet(mk(id), next);
  await indexCode(m.code, `m:${id}`);
  // Un solo correo aunque lleguen a la vez la respuesta del cobro y el webhook.
  if ((await redis("SET", `lg:mbmail:${id}`, "1", "NX", "EX", 40 * 24 * 3600)) === "OK") await sendMembershipConfirmed(next).catch(() => {});
  return next;
}

/** Pago "en revisión": mantenemos las 6 horas apartadas más tiempo. */
export async function markMembershipPending(id: string, paymentId: string, status: string): Promise<void> {
  const m = await getMembership(id);
  if (!m || m.status !== "hold") return;
  await extendCells(washCells(m), m.id, PENDING_SEC);
  await kvSet(mk(id), { ...m, status: "pending", paymentId, paymentStatus: status, updatedAt: new Date().toISOString() }, 3 * 24 * 3600);
  await indexCode(m.code, `m:${id}`);
}
