import { estimateFreeAt, fromMin, isOpenAt, localNow, nextOpening, type Spot } from "./booking-core";
import { BUSINESS } from "./config";
import type { Settings } from "./settings";
import { kvGet, kvSet } from "./store";

// Controles en /admin:
//   mode "auto": abre y cierra solo según el horario de Ajustes.
//   mode "open" / "closed": decisión manual que manda sobre el horario SOLO ese día (modeDate);
//   al día siguiente vuelve sola a "auto".
//   busy: hay un auto en la fosa (OCUPADO) o no (LIBRE). busySince/busyMinutes: para estimar cuándo se desocupa.
export type GarageStatus = "LIBRE" | "OCUPADO" | "CERRADO";
export type OpenMode = "auto" | "open" | "closed";
export interface GarageRecord {
  mode: OpenMode; modeDate: string | null; busy: boolean; updatedAt: string | null; open?: boolean;
  busySince?: string | null; busyMinutes?: number | null;
}
export interface PublicGarage {
  status: GarageStatus; updatedAt: string | null;
  now: string; busyUntil: string | null; freeInMin: number | null;
  opens?: { label: string; inMinutes: number } | null;
  next: { completo: Spot | null; exterior: Spot | null };
}
export type Reason = "manual-open" | "manual-closed" | "schedule-open" | "schedule-closed";

const KEY = "lg:garage:v2";
const DEFAULT: GarageRecord = { mode: "auto", modeDate: null, busy: false, updatedAt: null, busySince: null, busyMinutes: null };

/** Lanza error si el almacén falla: es preferible "reconectando" a mostrar un estado falso. */
export async function getGarage(): Promise<GarageRecord> {
  const r = { ...DEFAULT, ...((await kvGet<GarageRecord>(KEY)) ?? {}) };
  if (r.open === false && r.mode === "auto" && !r.modeDate) { r.mode = "closed"; r.modeDate = localDate(); } // formato anterior
  return r;
}

export async function patchGarage(patch: { mode?: OpenMode; busy?: boolean; minutes?: number }): Promise<GarageRecord> {
  const cur = await getGarage();
  const now = new Date().toISOString();
  const rec: GarageRecord = {
    ...cur, open: undefined,
    ...(patch.mode ? { mode: patch.mode, modeDate: patch.mode === "auto" ? null : localDate() } : {}),
    ...(patch.busy === true ? { busy: true, busySince: now, busyMinutes: patch.minutes ?? 30 } : {}),
    ...(patch.busy === false ? { busy: false, busySince: null, busyMinutes: null } : {}),
    updatedAt: now,
  };
  await kvSet(KEY, rec);
  return rec;
}

export function localDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function isWithinHours(h: Settings["hours"], d = new Date()): boolean {
  const n = localNow(d);
  return isOpenAt(h, n.date, n.minutes);
}

/** ¿Está abierto ahora y por qué? (la decisión manual del día manda sobre el horario) */
export function openState(rec: GarageRecord, h: Settings["hours"], now = new Date()): { open: boolean; reason: Reason } {
  const manual = rec.mode !== "auto" && rec.modeDate === localDate(now);
  if (manual) return rec.mode === "open" ? { open: true, reason: "manual-open" } : { open: false, reason: "manual-closed" };
  return isWithinHours(h, now) ? { open: true, reason: "schedule-open" } : { open: false, reason: "schedule-closed" };
}

/** Minuto del día (hoy) en que se estima que se desocupa la fosa, o null si no está ocupada. */
export function busyUntilMin(rec: GarageRecord, now = new Date()): number | null {
  if (!rec.busy) return null;
  const since = rec.busySince ? localNow(new Date(rec.busySince)) : null;
  return estimateFreeAt(since, rec.busyMinutes ?? 30, localNow(now));
}
export const busyUntilText = (rec: GarageRecord, now = new Date()) => { const m = busyUntilMin(rec, now); return m == null ? null : fromMin(Math.min(m, 24 * 60 - 1)); };

/** ¿Cerraron a mano hoy? (entonces hoy no se reserva) */
export const closedToday = (rec: GarageRecord, h: Settings["hours"], now = new Date()) => openState(rec, h, now).reason === "manual-closed";

/** Lo que ve el público: estado, hora y próximo lugar. Nunca quién está. `next` lo calcula bookings.ts. */
export function toPublic(rec: GarageRecord, h: Settings["hours"], now = new Date(), next: PublicGarage["next"] = { completo: null, exterior: null }): PublicGarage {
  const st = openState(rec, h, now);
  const ln = localNow(now);
  const until = st.open && rec.busy ? busyUntilMin(rec, now) : null;
  // Ocupado solo mientras la estimación siga vigente; si ya pasó la tolerancia, el semáforo vuelve a LIBRE solo.
  const status: GarageStatus = !st.open ? "CERRADO" : until !== null ? "OCUPADO" : "LIBRE";
  // Cerrado: decimos cuándo abrimos (si lo cerraron a mano hoy, saltamos al siguiente día).
  const opens = status === "CERRADO" ? nextOpening(h, ln, st.reason === "manual-closed") : undefined;
  return {
    status, updatedAt: rec.updatedAt, now: fromMin(ln.minutes),
    busyUntil: until == null ? null : fromMin(Math.min(until, 24 * 60 - 1)),
    freeInMin: until == null ? null : Math.max(0, until - ln.minutes),
    ...(opens !== undefined ? { opens } : {}),
    next,
  };
}
