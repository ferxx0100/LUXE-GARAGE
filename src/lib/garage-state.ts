import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { BUSINESS } from "./config";

// LIBRE: se puede llegar ya. OCUPADO: hay un auto adentro. BLOQUEADO: el admin lo cerró.
// (CERRADO por horario se calcula, no se guarda.)
export const GarageMode = z.enum(["LIBRE", "OCUPADO", "BLOQUEADO"]);
export type GarageMode = z.infer<typeof GarageMode>;
export type GarageStatus = "LIBRE" | "OCUPADO" | "CERRADO";

export interface GarageRecord { mode: GarageMode; updatedAt: string }
export interface PublicGarage { status: GarageStatus; updatedAt: string }

/** Interfaz de almacenamiento. Fase 3 la implementa con Supabase (Postgres + Realtime). */
export interface GarageStore {
  get(): Promise<GarageRecord>;
  set(mode: GarageMode): Promise<GarageRecord>;
}

// Memoria de proceso: sirve para desarrollo. En Vercel NO se comparte entre instancias.
const g = globalThis as unknown as { __garage?: GarageRecord };
export const memoryStore: GarageStore = {
  async get() {
    return (g.__garage ??= { mode: "LIBRE", updatedAt: new Date().toISOString() });
  },
  async set(mode) {
    return (g.__garage = { mode, updatedAt: new Date().toISOString() });
  },
};

function localParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS.timezone, weekday: "short", hour: "numeric", hour12: false,
  }).formatToParts(d);
  const wd = f.find((p) => p.type === "weekday")!.value;
  const hour = Number(f.find((p) => p.type === "hour")!.value) % 24;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  return { day, hour };
}

export function isWithinHours(d = new Date()): boolean {
  const { day, hour } = localParts(d);
  return (BUSINESS.hours.days as readonly number[]).includes(day) &&
    hour >= BUSINESS.hours.open && hour < BUSINESS.hours.close;
}

export function toPublic(rec: GarageRecord, now = new Date()): PublicGarage {
  // BLOQUEADO y fuera de horario se muestran igual al público: CERRADO. Sin datos de personas.
  const status: GarageStatus =
    rec.mode === "BLOQUEADO" || !isWithinHours(now) ? "CERRADO" : rec.mode;
  return { status, updatedAt: rec.updatedAt };
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
