// Formatos de fecha y hora para el navegador (sin node:crypto, a diferencia de booking-core).
export type Kind = "completo" | "exterior";
export type Vehicle = "carro" | "camioneta" | "suv";
export const VEHICLES: Vehicle[] = ["carro", "camioneta", "suv"];
/** Tamaño para que se entienda rápido: S carro, M camioneta, XL SUV o pick up. */
export const SIZE_TAG: Record<Vehicle, string> = { carro: "S", camioneta: "M", suv: "XL" };
/** Lo que tarda la lavada (min), igual que en el servidor. */
export const WASH_MIN: Record<Vehicle, number> = { carro: 50, camioneta: 60, suv: 100 };
export type Service = "sencillo" | "profundo" | "detallado";
export const SERVICE_DUR: Record<Service, Record<Vehicle, number>> = {
  sencillo: WASH_MIN,
  profundo: { carro: 90, camioneta: 105, suv: 150 },
  detallado: { carro: 150, camioneta: 180, suv: 240 },
};
export const serviceLabel = (s?: string | null) => (s === "profundo" ? "Lavado profundo" : s === "detallado" ? "Detallado exterior" : "Lavado sencillo");
export const durText = (min: number) => (min < 60 ? `${min} min` : min % 60 ? `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")} h` : `${min / 60} h`);
export const vehicleLabel = (v?: string | null) => (v === "carro" ? "Carro" : v === "camioneta" ? "Camioneta" : v === "suv" ? "SUV o pick up" : "");
export type DayHours = { open: number; close: number } | null;

export const KIND: Record<Kind, { title: string; sub: string; min: number }> = {
  completo: { title: "Exterior e interior", sub: "Dejas tu auto con nosotros", min: 30 },
  exterior: { title: "Solo exterior", sub: "No necesitas bajarte", min: 20 },
};

export const DAY = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const MONTH = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const pad = (n: number) => String(n).padStart(2, "0");

export const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const wd = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
/** "Martes 4 de noviembre" */
export const longDay = (d: string) => `${DAY[wd(d)]} ${Number(d.slice(8))} de ${MONTH[Number(d.slice(5, 7)) - 1]}`;
export const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const fromMin = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

/** "16:30" → "4:30 pm", "12:00" → "12 pm" */
export function hour12(t: string): string {
  const h = Number(t.slice(0, 2)), m = Number(t.slice(3, 5)), n = h % 12 || 12;
  return `${n}${m ? `:${pad(m)}` : ""} ${h < 12 ? "am" : "pm"}`;
}
/** ("16:30", 30) → "4:30 – 5:00 pm" */
export function range12(t: string, dur: number): string {
  const a = toMin(t), b = a + dur, ap = (x: number) => (Math.floor(x / 60) % 24 < 12 ? "am" : "pm");
  const s = (x: number) => `${Math.floor(x / 60) % 12 || 12}:${pad(x % 60)}`;
  return ap(a) === ap(b) ? `${s(a)} – ${s(b)} ${ap(b)}` : `${s(a)} ${ap(a)} – ${s(b)} ${ap(b)}`;
}
/** "en 20 min", "en 1 h 10 min" */
export function inText(min: number): string {
  if (min <= 0) return "ahora";
  if (min < 60) return `en ${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return h >= 24 ? "" : `en ${h} h${m ? ` ${m} min` : ""}`;
}

/** Hora de pared en Zamora (America/Mexico_City). */
export function mxNow(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => Number(f.find((x) => x.type === t)?.value ?? 0);
  const h = g("hour") % 24, m = g("minute"), s = g("second");
  return { date: `${g("year")}-${pad(g("month"))}-${pad(g("day"))}`, h, m, s, minutes: h * 60 + m };
}
/** "Son las 4:10 pm" / "Es la 1:05 pm" */
