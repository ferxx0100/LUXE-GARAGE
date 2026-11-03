import { randomBytes } from "node:crypto";
import { z } from "zod";
import { canBook, localNow, priceFor, shortCode, slotsFor, toMinutes, type Kind, type Place, type Vehicle } from "./booking-core";
import { BUSINESS } from "./config";
import { sendBookingCancelled, sendBookingConfirmed } from "./mail";
import { getSettings } from "./settings";
import { kvGet, kvSet, redis } from "./store";

/* ───────── Datos que pedimos (mínimos, LFPDPPP) ───────── */
export const BookingInput = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    vehicle: z.enum(["carro", "camioneta"]),
    kind: z.enum(["completo", "exterior"]),
    place: z.enum(["garage", "domicilio"]),
    address: z.string().trim().max(200).default(""),
    name: z.string().trim().min(2, "Escribe tu nombre").max(80),
    phone: z.string().trim().max(20).transform((s) => s.replace(/\D/g, "")).refine((d) => d.length >= 10 && d.length <= 13, "Teléfono a 10 dígitos"),
    email: z.string().trim().toLowerCase().email("Correo inválido").max(120).or(z.literal("")).default(""), // lo pide Mercado Pago al pagar
    plate: z.string().trim().toUpperCase().min(5, "Escribe tus placas").max(12).regex(/^[A-Z0-9 -]*$/, "Placas inválidas"),
    notes: z.string().trim().max(300).default(""),
    privacy: z.boolean().default(true), // aviso mostrado junto al botón de pagar (consentimiento tácito, datos no sensibles)
  })
  .refine((b) => b.place !== "domicilio" || b.address.length >= 8, { message: "Escribe la dirección completa", path: ["address"] });

export type BookingStatus = "hold" | "pending" | "confirmed" | "done" | "cancelled" | "conflict";
export interface Booking {
  id: string; code: string; status: BookingStatus;
  date: string; time: string; vehicle: Vehicle; kind: Kind; place: Place; address: string;
  name: string; phone: string; email: string; plate: string; notes: string;
  amount: number; paymentId?: string; paymentStatus?: string; paidAt?: string;
  createdAt: string; updatedAt: string;
}

const HOLD_SEC = BUSINESS.holdMinutes * 60; // horario apartado mientras pagan
const PENDING_SEC = 2 * 60 * 60;            // pago "en revisión" de Mercado Pago
const bk = (id: string) => `lg:bk:${id}`;
const slotKey = (date: string, time: string) => `lg:slot:${date}:${time}`;
const dayKey = (date: string) => `lg:day:${date}`;
export const isBookingId = (id: string) => /^[A-Za-z0-9_-]{22}$/.test(id);

/** Disponibilidad pública: solo libre/ocupado, nunca quién reservó. */
export async function availability(date: string): Promise<{ time: string; free: boolean }[]> {
  const s = await getSettings();
  const slots = slotsFor(s.hours, date);
  if (!slots.length) return [];
  const owners = await redis<(string | null)[]>("MGET", ...slots.map((t) => slotKey(date, t)));
  const now = localNow();
  return slots.map((time, i) => ({ time, free: !owners[i] && canBook(s.hours, date, time, now) }));
}

type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

/** Aparta el horario (atómico: SET NX) y crea la reserva sin pagar. */
export async function createHold(input: z.infer<typeof BookingInput>): Promise<Result<Booking>> {
  const s = await getSettings();
  if (!canBook(s.hours, input.date, input.time, localNow())) return { ok: false, status: 409, error: "Ese horario ya no está disponible. Elige otro." };
  const id = randomBytes(16).toString("base64url");
  const got = await redis("SET", slotKey(input.date, input.time), id, "NX", "EX", HOLD_SEC);
  if (got !== "OK") return { ok: false, status: 409, error: "Alguien acaba de apartar ese horario. Elige otro." };
  const now = new Date().toISOString();
  const { privacy: _accepted, ...data } = input;
  const b: Booking = {
    ...data, address: input.place === "domicilio" ? input.address : "",
    id, code: shortCode(id), status: "hold", amount: priceFor(s.prices, input.vehicle, input.place), createdAt: now, updatedAt: now,
  };
  await kvSet(bk(id), b, 2 * 24 * 3600); // si nunca se paga, se borra sola
  return { ok: true, value: b };
}

export async function getBooking(id: string): Promise<Booking | null> {
  return isBookingId(id) ? kvGet<Booking>(bk(id)) : null;
}

export async function holdStillValid(b: Booking): Promise<boolean> {
  return (await redis<string | null>("GET", slotKey(b.date, b.time))) === b.id;
}

async function index(b: Booking) {
  await redis("ZADD", dayKey(b.date), toMinutes(b.time), b.id);
}

/** Pago aprobado → confirma (idempotente). Si el apartado expiró y otro tomó la hora: "conflict". */
export async function confirmBooking(id: string, paymentId: string): Promise<Booking | null> {
  const b = await getBooking(id);
  if (!b) return null;
  if (b.status === "confirmed" || b.status === "done") return b;
  const key = slotKey(b.date, b.time);
  const owner = await redis<string | null>("GET", key);
  let mine = owner === b.id;
  if (mine) await redis("PERSIST", key);
  else if (!owner) mine = (await redis("SET", key, b.id, "NX")) === "OK";
  const now = new Date().toISOString();
  const next: Booking = { ...b, status: mine ? "confirmed" : "conflict", paymentId, paymentStatus: "approved", paidAt: now, updatedAt: now };
  await kvSet(bk(id), next);
  await index(next);
  if (next.status === "confirmed") await sendBookingConfirmed(next).catch(() => {}); // solo una vez: arriba se sale si ya estaba confirmada
  return next;
}

/** Pago "en revisión": mantenemos el horario apartado más tiempo. */
/** Guarda el correo que el cliente dio en el formulario de pago (para mandarle su confirmación). */
export async function setEmail(id: string, email: string): Promise<void> {
  const b = await getBooking(id);
  if (!b || b.email === email) return;
  await kvSet(bk(id), { ...b, email, updatedAt: new Date().toISOString() }, b.status === "hold" ? 2 * 24 * 3600 : undefined);
}

export async function markPending(id: string, paymentId: string, status: string): Promise<void> {
  const b = await getBooking(id);
  if (!b || b.status !== "hold") return;
  await redis("EXPIRE", slotKey(b.date, b.time), PENDING_SEC);
  const next: Booking = { ...b, status: "pending", paymentId, paymentStatus: status, updatedAt: new Date().toISOString() };
  await kvSet(bk(id), next, 3 * 24 * 3600);
  await index(next);
}

/* ───────── Panel ───────── */
export async function listBookings(dates: string[]): Promise<Booking[]> {
  const ids = (await Promise.all(dates.map((d) => redis<string[]>("ZRANGE", dayKey(d), 0, -1)))).flat();
  if (!ids.length) return [];
  const raw = await redis<(string | null)[]>("MGET", ...ids.map(bk));
  return raw.filter(Boolean).map((r) => JSON.parse(r!) as Booking);
}

export async function adminAction(id: string, action: "done" | "cancel" | "confirm"): Promise<Booking | null> {
  const b = await getBooking(id);
  if (!b) return null;
  const now = new Date().toISOString();
  let status: BookingStatus = b.status;
  if (action === "done") status = "done";
  if (action === "confirm") status = "confirmed";
  if (action === "cancel") {
    status = "cancelled";
    const key = slotKey(b.date, b.time);
    if ((await redis<string | null>("GET", key)) === b.id) await redis("DEL", key); // libera el horario
  }
  const next = { ...b, status, updatedAt: now };
  await kvSet(bk(id), next);
  if (action === "cancel" && ["confirmed", "pending", "conflict"].includes(b.status)) await sendBookingCancelled(next).catch(() => {});
  if (action === "confirm" && b.status === "pending") await sendBookingConfirmed(next).catch(() => {});
  return next;
}
