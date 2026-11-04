import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  addDays, blocksFromCells, candidateStarts, CELL, cellsFor, dayWindow, fits, fromMin, inRange, isTimeStr, localNow, nextFree,
  priceFor, sealFor, sealSecondsLeft, sealWindow, SERVICE_MIN, shortCode, spotLabel, toMin, washMin,
  type Block, type Kind, type Now, type Place, type Spot, type Vehicle,
} from "./booking-core";
import { serverKey } from "./auth";
import { BUSINESS } from "./config";
import { busyUntilMin, closedToday, getGarage, toPublic, type GarageRecord, type PublicGarage } from "./garage-state";
import { sendBookingCancelled, sendBookingConfirmed } from "./mail";
import { getSettings, type Settings } from "./settings";
import { claimCells, extendCells, kvGet, kvSet, ownsCells, readCells, redis, releaseCells, reserveCells } from "./store";

/* ───────── Datos que pedimos (mínimos, LFPDPPP): nombre y teléfono ───────── */
export const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const TimeStr = z.string().regex(/^\d{2}:\d{2}$/);
export const Name = z.string().trim().min(2, "Escribe tu nombre").max(80);
export const Phone = z.string().trim().max(20).transform((s) => s.replace(/\D/g, "")).refine((d) => d.length >= 10 && d.length <= 13, "Teléfono a 10 dígitos");
export const Email = z.string().trim().toLowerCase().email("Correo inválido").max(120).or(z.literal("")).default(""); // lo pide Mercado Pago al pagar
export const Plate = z.string().trim().toUpperCase().max(12).regex(/^[A-Z0-9 -]*$/, "Placas inválidas").default(""); // ya no se piden

export const BookingInput = z
  .object({
    date: DateStr,
    time: TimeStr,
    vehicle: z.enum(["carro", "camioneta", "suv"]),
    kind: z.enum(["completo", "exterior"]),
    place: z.enum(["garage", "domicilio"]),
    address: z.string().trim().max(200).default(""),
    name: Name,
    phone: Phone,
    email: Email,
    plate: Plate,
    notes: z.string().trim().max(300).default(""),
    privacy: z.boolean().default(true), // aviso mostrado junto al botón de pagar (consentimiento tácito, datos no sensibles)
  })
  .refine((b) => b.place !== "domicilio" || b.address.length >= 8, { message: "Escribe la dirección completa", path: ["address"] });

export type BookingStatus = "hold" | "pending" | "confirmed" | "done" | "cancelled" | "conflict";
export interface Booking {
  id: string; code: string; status: BookingStatus;
  date: string; time: string; duration: number; kind: Kind; place: Place; address: string;
  /** Sin vehículo = lavada de membresía: va a nombre de la persona y trae el auto que quiera. */
  vehicle?: Vehicle;
  name: string; phone: string; email: string; plate: string; notes: string;
  amount: number; paymentId?: string; paymentStatus?: string; paidAt?: string;
  /** Dueño de las celdas de agenda: el propio id, o el de la membresía. */
  owner?: string; membershipId?: string; membershipCode?: string;
  /** Sello de lavada hecha: quién la selló (Dueño o nombre del empleado) y cuándo. */
  doneBy?: string; doneAt?: string;
  createdAt: string; updatedAt: string;
}

export const HOLD_SEC = BUSINESS.holdMinutes * 60; // horario apartado mientras pagan
export const PENDING_SEC = 2 * 60 * 60;            // pago "en revisión" de Mercado Pago
const bk = (id: string) => `lg:bk:${id}`;
const dayKey = (date: string) => `lg:day:${date}`;
const codeKey = (code: string) => `lg:code:${code}`;
export const isBookingId = (id: string) => /^[A-Za-z0-9_-]{22}$/.test(id);

/** Reservas viejas (antes de las celdas) eran de 1 hora. */
export const durationOf = (b: Pick<Booking, "duration">) => b.duration ?? 60;
const ownerOf = (b: Booking) => b.owner ?? b.id;
const cellsOf = (b: Booking) => cellsFor(b.date, toMin(b.time), durationOf(b));

type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

/* ───────── Contexto de "ahora": ajustes, fosa y cierre manual ───────── */
export type Ctx = { s: Settings; g: GarageRecord; now: Now; busyMin: number | null; closed: boolean };
export async function todayCtx(d = new Date()): Promise<Ctx> {
  const [s, g] = await Promise.all([getSettings(), getGarage()]);
  return { s, g, now: localNow(d), busyMin: busyUntilMin(g, d), closed: closedToday(g, s.hours, d) };
}

/**
 * Bloques ocupados de un día: sus celdas (una lectura MGET) + las reservas vivas del día.
 * Las reservas hechas con celdas de 10 min siguen bloqueando su horario completo.
 */
export async function dayBlocks(date: string, w: { open: number; close: number }): Promise<Block[]> {
  const [owners, list] = await Promise.all([readCells(cellsFor(date, w.open, w.close - w.open)), listBookings([date])]);
  const fromCells = blocksFromCells(owners.map((owner, i) => ({ start: w.open + i * CELL, owner })));
  const fromBookings = list.filter((b) => ["hold", "pending", "confirmed", "conflict"].includes(b.status))
    .map((b) => ({ start: toMin(b.time), end: toMin(b.time) + durationOf(b) }));
  return [...fromCells, ...fromBookings].sort((a, b) => a.start - b.start);
}

/** ¿Se puede ofrecer ese día? (dentro de los 30 días y no cerrado a mano hoy) */
const bookableDay = (c: Ctx, date: string) => inRange(date, c.now.date) && !(date === c.now.date && c.closed);
const busyFor = (c: Ctx, date: string) => (date === c.now.date ? c.busyMin : null);

/** Disponibilidad pública: solo horas libres, nunca quién reservó. */
export async function availability(date: string, kind: Kind, vehicle?: Vehicle) {
  const c = await todayCtx();
  const duration = vehicle ? washMin(vehicle) : SERVICE_MIN[kind];
  const w = dayWindow(c.s.hours, date);
  if (!w || !bookableDay(c, date)) return { date, kind, duration, starts: [] as string[], next: null as string | null };
  const blocks = await dayBlocks(date, w);
  const busy = busyFor(c, date);
  const nx = nextFree(c.s.hours, date, duration, blocks, c.now, busy);
  return { date, kind, duration, starts: candidateStarts(c.s.hours, date, duration, blocks, c.now, busy).map(fromMin), next: nx == null ? null : fromMin(nx) };
}

/** Próximo lugar reservable en línea para cada servicio: hoy y, si no hay, los siguientes 7 días. */
export async function nextSpots(c: Ctx): Promise<PublicGarage["next"]> {
  const out: PublicGarage["next"] = { completo: null, exterior: null };
  const kinds = ["completo", "exterior"] as const;
  for (let i = 0; i <= 7 && (!out.completo || !out.exterior); i++) {
    const date = addDays(c.now.date, i), w = dayWindow(c.s.hours, date);
    if (!w || !bookableDay(c, date)) continue;
    const busy = busyFor(c, date);
    const durOf = (k: Kind) => (k === "completo" ? washMin("carro") : SERVICE_MIN[k]);
    if (kinds.every((k) => nextFree(c.s.hours, date, durOf(k), [], c.now, busy) == null)) continue; // ya no cabe nada hoy: sin leer
    const blocks = await dayBlocks(date, w);
    for (const k of kinds) {
      if (out[k]) continue;
      const m = nextFree(c.s.hours, date, durOf(k), blocks, c.now, busy);
      if (m == null) continue;
      const time = fromMin(m);
      out[k] = { date, time, inMinutes: i * 1440 + m - c.now.minutes, label: spotLabel(date, time, c.now) } satisfies Spot;
    }
  }
  return out;
}

/** Hora (hoy) en que empieza el siguiente turno apartado, para decir "Libre hasta las 5:00". */
async function freeUntil(c: Ctx): Promise<string | null> {
  const w = dayWindow(c.s.hours, c.now.date);
  if (!w || c.closed) return null;
  const blocks = await dayBlocks(c.now.date, w);
  const nx = blocks.find((b) => b.start >= c.now.minutes);
  return nx ? fromMin(nx.start) : null;
}

/** Todo lo que necesita GET /api/garage. */
export async function publicGarage(d = new Date()): Promise<PublicGarage> {
  const c = await todayCtx(d);
  const [next, until] = await Promise.all([nextSpots(c), freeUntil(c)]);
  return { ...toPublic(c.g, c.s.hours, d, next), freeUntil: until, busySince: c.g.busy && c.g.busySince ? fromMin(localNow(new Date(c.g.busySince)).minutes) : null };
}

/** Valida una hora para hoy/futuro (estructura, horario, 10 min de anticipación, fosa ocupada). */
export function startAllowed(c: Ctx, date: string, time: string, duration: number): boolean {
  return isTimeStr(time) && bookableDay(c, date) && fits(c.s.hours, date, toMin(time), duration, [], c.now, busyFor(c, date));
}

/** Aparta las celdas (atómico: todas o ninguna) y crea la reserva sin pagar. */
export async function createHold(input: z.infer<typeof BookingInput>): Promise<Result<Booking>> {
  const c = await todayCtx();
  const duration = washMin(input.vehicle);
  if (!startAllowed(c, input.date, input.time, duration)) return { ok: false, status: 409, error: "Esa hora ya no está disponible. Elige otra." };
  const id = randomBytes(16).toString("base64url");
  if (!(await reserveCells(cellsFor(input.date, toMin(input.time), duration), id, HOLD_SEC))) {
    return { ok: false, status: 409, error: "Alguien acaba de apartar esa hora. Elige otra." };
  }
  const now = new Date().toISOString();
  const { privacy: _accepted, ...data } = input;
  // Sin domicilio: siempre en el lugar. El precio sale de los ajustes (lavada suelta), nunca del navegador.
  const b: Booking = {
    ...data, place: "garage", address: "", duration, owner: id,
    id, code: shortCode(id), status: "hold", amount: priceFor(c.s.single, input.vehicle), createdAt: now, updatedAt: now,
  };
  await kvSet(bk(id), b, 2 * 24 * 3600); // si nunca se paga, se borra sola
  return { ok: true, value: b };
}

export async function getBooking(id: string): Promise<Booking | null> {
  return isBookingId(id) ? kvGet<Booking>(bk(id)) : null;
}

export async function getBookings(ids: string[]): Promise<Booking[]> {
  if (!ids.length) return [];
  const raw = await redis<(string | null)[]>("MGET", ...ids.map(bk));
  return raw.filter(Boolean).map((r) => { const b = JSON.parse(r!) as Booking; return { ...b, duration: durationOf(b) }; });
}

/** ¿Siguen siendo suyas todas sus celdas? */
export const holdStillValid = (b: Booking) => ownsCells(cellsOf(b), ownerOf(b));

/** Guarda la reserva y la indexa en la agenda del día. */
export async function saveIndexed(b: Booking, ttlSec?: number) {
  await kvSet(bk(b.id), b, ttlSec);
  await redis("ZADD", dayKey(b.date), toMin(b.time), b.id);
}

/** Código → reserva o membresía (para verificar recibos en el panel). El primero gana. */
export const indexCode = (code: string, ref: `b:${string}` | `m:${string}`) => redis("SET", codeKey(code), ref, "NX");
export const lookupCode = (code: string) => redis<string | null>("GET", codeKey(code));

/** Pago aprobado → confirma (idempotente). Si el apartado expiró y otro tomó la hora: "conflict". */
export async function confirmBooking(id: string, paymentId: string): Promise<Booking | null> {
  const b = await getBooking(id);
  if (!b) return null;
  if (b.status === "confirmed" || b.status === "done") return b;
  const mine = await claimCells(cellsOf(b), ownerOf(b));
  const now = new Date().toISOString();
  const next: Booking = { ...b, duration: durationOf(b), status: mine ? "confirmed" : "conflict", paymentId, paymentStatus: "approved", paidAt: now, updatedAt: now };
  await saveIndexed(next);
  await indexCode(next.code, `b:${id}`);
  // Un solo correo aunque lleguen a la vez la respuesta del cobro y el webhook.
  if (next.status === "confirmed" && (await redis("SET", `lg:bkmail:${id}`, "1", "NX", "EX", 40 * 24 * 3600)) === "OK") {
    await sendBookingConfirmed(next).catch(() => {});
  }
  return next;
}

/** Guarda el correo que el cliente dio en el formulario de pago (para mandarle su confirmación). */
export async function setEmail(id: string, email: string): Promise<void> {
  const b = await getBooking(id);
  if (!b || b.email === email) return;
  await kvSet(bk(id), { ...b, email, updatedAt: new Date().toISOString() }, b.status === "hold" ? 2 * 24 * 3600 : undefined);
}

/** Pago "en revisión": mantenemos las celdas apartadas más tiempo. */
export async function markPending(id: string, paymentId: string, status: string): Promise<void> {
  const b = await getBooking(id);
  if (!b || b.status !== "hold") return;
  await extendCells(cellsOf(b), ownerOf(b), PENDING_SEC);
  await saveIndexed({ ...b, status: "pending", paymentId, paymentStatus: status, updatedAt: new Date().toISOString() }, 3 * 24 * 3600);
  await indexCode(b.code, `b:${id}`);
}

/* ───────── Sello vivo (anti-falsificación) ───────── */
/** Sello de 3 dígitos que cambia cada 30 s. Solo el servidor lo sabe calcular. */
export function liveSeal(ownerId: string, ms = Date.now()) {
  return { seal: sealFor(serverKey(), ownerId, sealWindow(ms)), secondsLeft: sealSecondsLeft(ms) };
}

/* ───────── Panel ───────── */
export async function listBookings(dates: string[]): Promise<Booking[]> {
  const ids = (await Promise.all(dates.map((d) => redis<string[]>("ZRANGE", dayKey(d), 0, -1)))).flat();
  return getBookings(ids);
}

/** Guarda una reserva ya existente (sin cambiar sus índices). */
export async function kvSave(b: Booking): Promise<Booking> {
  const next = { ...b, updatedAt: new Date().toISOString() };
  await kvSet(bk(b.id), next);
  return next;
}

export async function adminAction(id: string, action: "done" | "cancel" | "confirm"): Promise<Booking | null> {
  const b = await getBooking(id);
  if (!b) return null;
  let status: BookingStatus = b.status;
  if (action === "done") status = "done";
  if (action === "confirm") status = (await claimCells(cellsOf(b), ownerOf(b))) ? "confirmed" : "conflict";
  if (action === "cancel") {
    status = "cancelled";
    await releaseCells(cellsOf(b), ownerOf(b)); // libera solo sus celdas
  }
  const next: Booking = { ...b, duration: durationOf(b), status, updatedAt: new Date().toISOString() };
  await kvSet(bk(id), next);
  if (action === "cancel" && ["confirmed", "pending", "conflict"].includes(b.status)) await sendBookingCancelled(next).catch(() => {});
  if (action === "confirm" && b.status === "pending" && status === "confirmed") await sendBookingConfirmed(next).catch(() => {});
  return next;
}
