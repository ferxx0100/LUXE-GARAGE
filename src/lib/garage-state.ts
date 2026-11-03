import { z } from "zod";
import { BUSINESS } from "./config";
import type { Settings } from "./settings";
import { kvGet, kvSet } from "./store";

// LIBRE: se puede llegar ya. OCUPADO: hay un auto adentro. BLOQUEADO: el admin lo cerró.
// (CERRADO por horario se calcula, no se guarda.)
export const GarageMode = z.enum(["LIBRE", "OCUPADO", "BLOQUEADO"]);
export type GarageMode = z.infer<typeof GarageMode>;
export type GarageStatus = "LIBRE" | "OCUPADO" | "CERRADO";

export interface GarageRecord { mode: GarageMode; updatedAt: string | null }
export interface PublicGarage { status: GarageStatus; updatedAt: string | null }

const KEY = "lg:garage";

/** Lanza error si el almacén falla: es preferible "reconectando" a mostrar un estado falso. */
export async function getGarage(): Promise<GarageRecord> {
  return (await kvGet<GarageRecord>(KEY)) ?? { mode: "LIBRE", updatedAt: null };
}

export async function setGarage(mode: GarageMode): Promise<GarageRecord> {
  const rec = { mode, updatedAt: new Date().toISOString() };
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
  // BLOQUEADO y fuera de horario se muestran igual al público: CERRADO. Sin datos de personas.
  const status: GarageStatus = rec.mode === "BLOQUEADO" || !isWithinHours(h, now) ? "CERRADO" : rec.mode;
  return { status, updatedAt: rec.updatedAt };
}
