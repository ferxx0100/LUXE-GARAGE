import { isOpenAt, localNow, nextOpening } from "./booking-core";
import { BUSINESS } from "./config";
import type { Settings } from "./settings";
import { kvGet, kvSet } from "./store";

// Controles en /admin:
//   mode "auto": abre y cierra solo según el horario de Ajustes.
//   mode "open" / "closed": decisión manual que manda sobre el horario SOLO ese día (modeDate);
//   al día siguiente vuelve sola a "auto".
//   busy: hay un auto en la fosa (OCUPADO) o no (LIBRE).
export type GarageStatus = "LIBRE" | "OCUPADO" | "CERRADO";
export type OpenMode = "auto" | "open" | "closed";
export interface GarageRecord { mode: OpenMode; modeDate: string | null; busy: boolean; updatedAt: string | null; open?: boolean }
export interface PublicGarage { status: GarageStatus; updatedAt: string | null; opens?: { label: string; inMinutes: number } | null }
export type Reason = "manual-open" | "manual-closed" | "schedule-open" | "schedule-closed";

const KEY = "lg:garage:v2";
const DEFAULT: GarageRecord = { mode: "auto", modeDate: null, busy: false, updatedAt: null };

/** Lanza error si el almacén falla: es preferible "reconectando" a mostrar un estado falso. */
export async function getGarage(): Promise<GarageRecord> {
  const r = { ...DEFAULT, ...((await kvGet<GarageRecord>(KEY)) ?? {}) };
  if (r.open === false && r.mode === "auto" && !r.modeDate) { r.mode = "closed"; r.modeDate = localDate(); } // formato anterior
  return r;
}

export async function patchGarage(patch: { mode?: OpenMode; busy?: boolean }): Promise<GarageRecord> {
  const cur = await getGarage();
  const rec: GarageRecord = {
    ...cur, ...patch, open: undefined,
    modeDate: patch.mode ? (patch.mode === "auto" ? null : localDate()) : cur.modeDate,
    updatedAt: new Date().toISOString(),
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

export function toPublic(rec: GarageRecord, h: Settings["hours"], now = new Date()): PublicGarage {
  // Al público: solo el estado, nunca datos de quién está.
  const st = openState(rec, h, now);
  const status: GarageStatus = !st.open ? "CERRADO" : rec.busy ? "OCUPADO" : "LIBRE";
  // Cerrado: decimos cuándo abrimos (si lo cerraron a mano hoy, saltamos al siguiente día).
  const opens = status === "CERRADO" ? nextOpening(h, localNow(now), st.reason === "manual-closed") : undefined;
  return { status, updatedAt: rec.updatedAt, ...(opens !== undefined ? { opens } : {}) };
}
