import { BUSINESS } from "./config";
import type { Settings } from "./settings";
import { kvGet, kvSet } from "./store";

// Dos interruptores en /admin:
//   open: el negocio está abierto (false = cerrado manual, la cortina baja).
//   busy: hay un auto en la fosa (OCUPADO) o no (LIBRE).
// Fuera del horario configurado el público ve CERRADO aunque open = true.
export type GarageStatus = "LIBRE" | "OCUPADO" | "CERRADO";
export interface GarageRecord { open: boolean; busy: boolean; updatedAt: string | null }
export interface PublicGarage { status: GarageStatus; updatedAt: string | null }

const KEY = "lg:garage:v2";
const DEFAULT: GarageRecord = { open: true, busy: false, updatedAt: null };

/** Lanza error si el almacén falla: es preferible "reconectando" a mostrar un estado falso. */
export async function getGarage(): Promise<GarageRecord> {
  return { ...DEFAULT, ...((await kvGet<GarageRecord>(KEY)) ?? {}) };
}

export async function patchGarage(patch: Partial<Pick<GarageRecord, "open" | "busy">>): Promise<GarageRecord> {
  const rec = { ...(await getGarage()), ...patch, updatedAt: new Date().toISOString() };
  await kvSet(KEY, rec);
  return rec;
}

function localParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS.timezone, weekday: "short", hour: "numeric", hour12: false,
  }).formatToParts(d);
  const wd = f.find((p) => p.type === "weekday")!.value;
  const hour = Number(f.find((p) => p.type === "hour")!.value) % 24;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  return { day, hour };
}

export function isWithinHours(h: Settings["hours"], d = new Date()): boolean {
  const { day, hour } = localParts(d);
  return h.days.includes(day) && hour >= h.open && hour < h.close;
}

export function toPublic(rec: GarageRecord, h: Settings["hours"], now = new Date()): PublicGarage {
  // Al público: solo el estado, nunca datos de quién está.
  const status: GarageStatus = !rec.open || !isWithinHours(h, now) ? "CERRADO" : rec.busy ? "OCUPADO" : "LIBRE";
  return { status, updatedAt: rec.updatedAt };
}
