// Lógica pura de reservas: sin red ni base de datos, para poder probarla.
import { createHmac, timingSafeEqual } from "node:crypto";

export type Vehicle = "carro" | "camioneta";
export type Kind = "exterior" | "interior";
export type Place = "garage" | "domicilio";
export interface Prices { carro: number; camioneta: number; domicilio: number; suscripcion: number }
export interface Hours { open: number; close: number; days: number[] }

/** El precio lo calcula SIEMPRE el servidor con la configuración, nunca el navegador. */
export function priceFor(p: Prices, vehicle: Vehicle, place: Place): number {
  return p[vehicle] + (place === "domicilio" ? p.domicilio : 0);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha y hora "de pared" en una zona horaria (por defecto la del negocio). */
export function localNow(d = new Date(), tz = "America/Mexico_City") {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => f.find((x) => x.type === t)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")) };
}

export function isDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Horarios reservables de un día (uno por hora; el último empieza una hora antes de cerrar). */
export function slotsFor(h: Hours, date: string, slotMinutes = 60): string[] {
  if (!isDateStr(date) || !h.days.includes(weekday(date))) return [];
  const out: string[] = [];
  for (let m = h.open * 60; m + slotMinutes <= h.close * 60; m += slotMinutes) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  return out;
}

export const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * ¿Se puede reservar este horario ahora? Debe existir en el horario del día, estar dentro de la
 * ventana de días permitida y empezar al menos `leadMinutes` después de la hora actual.
 */
export function canBook(h: Hours, date: string, time: string, now: { date: string; minutes: number }, maxDays = 30, leadMinutes = 30): boolean {
  if (!slotsFor(h, date).includes(time)) return false;
  if (date < now.date || date > addDays(now.date, maxDays)) return false;
  if (date === now.date && toMinutes(time) < now.minutes + leadMinutes) return false;
  return true;
}

/** Código corto legible para el cliente (sin 0/O/1/I para no confundir). */
export function shortCode(id: string): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = Buffer.from(id, "base64url");
  let s = "";
  for (let i = 0; i < 6; i++) s += abc[bytes[i % bytes.length] % abc.length];
  return `LG-${s}`;
}

/**
 * Firma de webhooks de Mercado Pago. Header x-signature = "ts=...,v1=<hex>".
 * Manifiesto: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" firmado con HMAC-SHA256.
 */
export function verifyMpSignature(xSignature: string | null, xRequestId: string | null, dataId: string, secret: string): boolean {
  if (!xSignature || !secret || !dataId) return false;
  const parts = Object.fromEntries(xSignature.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const ts = parts.ts, v1 = parts.v1;
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};${xRequestId ? `request-id:${xRequestId};` : ""}ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1.toLowerCase(), "hex"));
}

/** Enmascara datos personales para logs/vistas públicas: 55****6823, j***@dominio.com. */
export function maskPhone(p: string) { const d = p.replace(/\D/g, ""); return d.length < 6 ? "****" : `${d.slice(0, 2)}****${d.slice(-4)}`; }
export function maskName(n: string) { const [first, ...rest] = n.trim().split(/\s+/); return [first, ...rest.map((r) => `${r[0]}.`)].join(" "); }
