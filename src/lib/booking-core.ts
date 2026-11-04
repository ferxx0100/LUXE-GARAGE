// Lógica pura de reservas: sin red ni base de datos, para poder probarla.
import { createHmac, timingSafeEqual } from "node:crypto";

export type Vehicle = "carro" | "camioneta";
export type Kind = "completo" | "exterior"; // "Exterior e interior" | "Solo exterior"
export type Place = "garage" | "domicilio"; // "domicilio" solo en reservas viejas: ya no se ofrece
export interface Prices { carro: number; camioneta: number }
/** Horario semanal: índice 0 = domingo … 6 = sábado; null = cerrado ese día. Horas enteras 0–24. */
export type DayHours = { open: number; close: number } | null;
export type Hours = DayHours[];

/** El precio lo calcula SIEMPRE el servidor con la configuración, nunca el navegador. */
export function priceFor(p: Prices, vehicle: Vehicle): number {
  return p[vehicle];
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

/** ¿Está dentro del horario en esa fecha/minuto del día? */
export function isOpenAt(h: Hours, date: string, minutes: number): boolean {
  const d = h[weekday(date)];
  return !!d && minutes >= d.open * 60 && minutes < d.close * 60;
}

const DAY_NAME = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
/** 12 → "12 pm", 13 → "1 pm", 9 → "9 am" (claro para todos). */
export function fmtHour(h: number): string {
  const hh = h % 24, n = hh % 12 === 0 ? 12 : hh % 12;
  return `${n} ${hh < 12 ? "am" : "pm"}`;
}
export const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return m ? `${fmtHour(h).replace(" ", `:${pad(m)} `)}` : fmtHour(h);
};

/**
 * Próxima apertura a partir de ahora. skipToday: el dueño cerró a mano hoy.
 * Devuelve el texto ("hoy a las 12 pm", "mañana martes a la 1 pm", "el viernes a la 1 pm") y los minutos que faltan.
 */
export function nextOpening(h: Hours, now: { date: string; minutes: number }, skipToday = false): { label: string; inMinutes: number } | null {
  for (let i = 0; i < 8; i++) {
    const date = addDays(now.date, i), d = h[weekday(date)];
    if (!d || (i === 0 && (skipToday || now.minutes >= d.open * 60))) continue;
    const at = `${d.open % 12 === 1 ? "a la" : "a las"} ${fmtHour(d.open)}`;
    const label = i === 0 ? `hoy ${at}` : i === 1 ? `mañana ${DAY_NAME[weekday(date)]} ${at}` : `el ${DAY_NAME[weekday(date)]} ${at}`;
    return { label, inMinutes: i * 1440 + d.open * 60 - now.minutes };
  }
  return null;
}

/** "Lunes a jueves de 12 pm a 7 pm · Viernes y sábado de 1 pm a 6 pm" */
export function hoursText(h: Hours): string {
  const NAME = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const order = [1, 2, 3, 4, 5, 6, 0];
  const groups: { days: number[]; open: number; close: number }[] = [];
  for (const d of order) {
    const x = h[d];
    if (!x) continue;
    const g = groups.at(-1);
    const prev = g?.days.at(-1);
    if (g && g.open === x.open && g.close === x.close && prev !== undefined && order.indexOf(d) === order.indexOf(prev) + 1) g.days.push(d);
    else groups.push({ days: [d], open: x.open, close: x.close });
  }
  if (!groups.length) return "Cerrado temporalmente";
  return groups.map((g) => {
    const days = g.days.length === 1 ? NAME[g.days[0]] : g.days.length === 2 ? `${NAME[g.days[0]]} y ${NAME[g.days[1]].toLowerCase()}` : `${NAME[g.days[0]]} a ${NAME[g.days.at(-1)!].toLowerCase()}`;
    return `${days} de ${fmtHour(g.open)} a ${fmtHour(g.close)}`;
  }).join(" · ");
}

/* ───────── Fechas y horas para el cliente ───────── */
const MONTH = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "lunes 3 de noviembre" */
export function fmtDay(date: string): string {
  const x = new Date(`${date}T12:00:00Z`);
  return `${DAY_NAME[x.getUTCDay()]} ${x.getUTCDate()} de ${MONTH[x.getUTCMonth()]}`;
}

/** Siempre con minutos: "16:00" → "4:00 pm", "12:30" → "12:30 pm". */
export function fmtClock(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return fmtHour(h).replace(" ", `:${pad(m)} `);
}

/** "a la 1 pm" / "a las 4:30 pm" */
export const atTime = (t: string) => `${Number(t.slice(0, 2)) % 12 === 1 ? "a la" : "a las"} ${fmtTime(t)}`;

/** Rango del servicio: ("16:00", 30) → "4:00 pm – 4:30 pm". */
export const fmtRange = (time: string, duration: number) => `${fmtClock(time)} – ${fmtClock(fromMin(toMin(time) + duration))}`;

/** Días entre dos fechas "YYYY-MM-DD" (b − a). */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

/** Texto del próximo lugar: "hoy 4:30 pm", "mañana miércoles 12 pm", "el viernes 1 pm" (y con fecha si es en más de una semana). */
export function spotLabel(date: string, time: string, now: { date: string }): string {
  const diff = daysBetween(now.date, date), t = fmtTime(time), day = DAY_NAME[weekday(date)];
  if (diff === 0) return `hoy ${t}`;
  if (diff === 1) return `mañana ${day} ${t}`;
  if (diff > 1 && diff < 7) return `el ${day} ${t}`;
  return `el ${fmtDay(date)} ${t}`;
}

/* ───────── Agenda de UNA sola fosa, en celdas de 10 minutos ───────── */
/** Duración del servicio en minutos: con interior deja el auto 30 min; solo exterior, 20 min sin bajarse. */
export const SERVICE_MIN = { completo: 30, exterior: 20 } as const satisfies Record<Kind, number>;
export const CELL = 10;        // tamaño de la celda de agenda (min)
export const LEAD_MIN = 10;    // hoy: la cita empieza al menos 10 min después de "ahora"
export const MAX_DAYS = 30;    // se reserva hasta 30 días adelante

export type Block = { start: number; end: number }; // minutos del día, [start, end)
export type Now = { date: string; minutes: number };
/** Próximo lugar reservable en línea (lo que muestra el hero). */
export type Spot = { date: string; time: string; inMinutes: number; label: string };

/** "HH:MM" ↔ minutos del día. */
export const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const fromMin = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const isTimeStr = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/** Apertura y cierre de ese día en minutos, o null si está cerrado (o la fecha no existe). */
export function dayWindow(h: Hours, date: string): { open: number; close: number } | null {
  const d = isDateStr(date) ? h[weekday(date)] : null;
  return d ? { open: d.open * 60, close: d.close * 60 } : null;
}

/** ¿La fecha está entre hoy y hoy + maxDays? */
export const inRange = (date: string, today: string, maxDays = MAX_DAYS) => isDateStr(date) && date >= today && date <= addDays(today, maxDays);

/**
 * ¿Cabe un servicio de `dur` minutos que empieza en `start`?
 * Rejilla de 10 min, dentro del horario, sin pasarse del cierre y sin traslaparse con otros bloques.
 * Si `now` es del mismo día: al menos LEAD_MIN después de ahora y después de que se desocupe la fosa (busyUntilMin).
 */
export function fits(h: Hours, date: string, start: number, dur: number, blocks: Block[], now?: Now, busyUntilMin?: number | null): boolean {
  const w = dayWindow(h, date);
  if (!w || !Number.isInteger(start) || start % CELL !== 0 || dur <= 0 || dur % CELL !== 0) return false;
  if (start < w.open || start + dur > w.close) return false;
  if (now) {
    if (date < now.date) return false;
    if (date === now.date) {
      if (start < now.minutes + LEAD_MIN) return false;
      if (busyUntilMin != null && start < busyUntilMin) return false;
    }
  }
  return blocks.every((b) => start + dur <= b.start || start >= b.end);
}

/** Primer inicio factible del día (rejilla de 10 min), o null si ya no cabe nada. */
export function nextFree(h: Hours, date: string, dur: number, blocks: Block[], now?: Now, busyUntilMin?: number | null): number | null {
  const w = dayWindow(h, date);
  if (!w) return null;
  for (let m = w.open; m + dur <= w.close; m += CELL) if (fits(h, date, m, dur, blocks, now, busyUntilMin)) return m;
  return null;
}

/**
 * Horas que ofrecemos al cliente (ascendentes, múltiplos de 10):
 * rejilla de su duración desde la apertura (cada 30 o cada 20 min)
 * ∪ horas en que terminan citas existentes (para pegar la siguiente) ∪ el inicio libre más próximo.
 */
export function candidateStarts(h: Hours, date: string, dur: number, blocks: Block[], now?: Now, busyUntilMin?: number | null): number[] {
  const w = dayWindow(h, date);
  if (!w) return [];
  const set = new Set<number>();
  for (let m = w.open; m + dur <= w.close; m += dur) set.add(m);
  for (const b of blocks) set.add(b.end);
  const nx = nextFree(h, date, dur, blocks, now, busyUntilMin);
  if (nx != null) set.add(nx);
  return [...set].filter((m) => fits(h, date, m, dur, blocks, now, busyUntilMin)).sort((a, b) => a - b);
}

/** Claves de las celdas que ocupa un servicio: "lg:cell:YYYY-MM-DD:HHMM". */
export function cellsFor(date: string, start: number, dur: number): string[] {
  const out: string[] = [];
  for (let m = start; m < start + dur; m += CELL) out.push(`lg:cell:${date}:${fromMin(m).replace(":", "")}`);
  return out;
}

/** Celdas leídas del almacén (inicio + dueño) → bloques ocupados. Celdas seguidas del mismo dueño = un bloque. */
export function blocksFromCells(cells: { start: number; owner: string | null }[]): Block[] {
  const out: (Block & { owner: string })[] = [];
  for (const c of [...cells].sort((a, b) => a.start - b.start)) {
    if (!c.owner) continue;
    const last = out.at(-1);
    if (last && last.owner === c.owner && last.end === c.start) last.end = c.start + CELL;
    else out.push({ start: c.start, end: c.start + CELL, owner: c.owner });
  }
  return out.map(({ start, end }) => ({ start, end }));
}

/**
 * Valida las lavadas que elige un miembro al comprar su membresía (todas en el servidor).
 * Devuelve el error para el cliente o null si todo cabe.
 */

export function checkWashes(o: {
  hours: Hours; washes: { date: string; time: string }[]; dur: number; count: number; now: Now;
  blocksByDate: Record<string, Block[]>; busyUntilMin?: number | null; closedToday?: boolean; maxDays?: number; days?: number[];
}): string | null {
  if (o.washes.length !== o.count) return `Elige tus ${o.count} lavadas.`;
  if (new Set(o.washes.map((w) => w.date)).size !== o.washes.length) return "Elige un día distinto para cada lavada.";
  for (const w of o.washes) {
    if (!isDateStr(w.date) || !isTimeStr(w.time)) return "Revisa las fechas de tus lavadas.";
    if (!inRange(w.date, o.now.date, o.maxDays ?? MAX_DAYS)) return "Todas tus lavadas deben quedar dentro de tu mes de membresía.";
    if (o.days && !o.days.includes(weekday(w.date))) return "Ese día no está disponible para tu membresía.";
    const taken = o.closedToday && w.date === o.now.date;
    if (taken || !fits(o.hours, w.date, toMin(w.time), o.dur, o.blocksByDate[w.date] ?? [], o.now, o.busyUntilMin)) {
      return `La lavada del ${fmtDay(w.date)} ${atTime(w.time)} ya no está disponible. Elige otra hora.`;
    }
  }
  return null;
}

/**
 * ¿A qué hora (minutos del día) se desocupa la fosa? `since` = cuándo se marcó OCUPADO, `minutes` = duración marcada.
 * Si ya pasó la hora estimada (o se marcó otro día) y sigue ocupado, estimamos ahora + 5 min.
 */
export const BUSY_GRACE = 20; // min de tolerancia después de la hora estimada
/**
 * Fin estimado del lavado en curso (minutos del día).
 * - Si ya pasó la hora estimada pero dentro de la tolerancia: "terminando" (= ahora).
 * - Si pasaron más de 20 min o fue otro día: null → se asume que olvidaron poner Libre y se muestra LIBRE.
 */
export function estimateFreeAt(since: Now | null, minutes: number, now: Now): number | null {
  if (!since) return now.minutes + 5;
  if (since.date !== now.date) return null;
  const end = since.minutes + minutes;
  if (now.minutes > end + BUSY_GRACE) return null;
  return Math.max(end, now.minutes);
}

/* ───────── Sello vivo del comprobante ───────── */
export const SEAL_SEC = 30;
/** Ventana de 30 s a la que pertenece un instante. */
export const sealWindow = (ms = Date.now()) => Math.floor(ms / 1000 / SEAL_SEC);
/** Segundos que le quedan a la ventana actual (1–30). */
export const sealSecondsLeft = (ms = Date.now()) => SEAL_SEC - (Math.floor(ms / 1000) % SEAL_SEC);
/** Sello de 3 dígitos: HMAC-SHA256(llave del servidor, dueño:ventana). Sin la llave no se puede adivinar. */
export function sealFor(key: string, ownerId: string, window: number): string {
  const mac = createHmac("sha256", key).update(`${ownerId}:${window}`).digest();
  return String(mac.readUInt32BE(0) % 1000).padStart(3, "0");
}

/** Código corto legible para el cliente (sin 0/O/1/I para no confundir). */
export function shortCode(id: string): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = Buffer.from(id, "base64url");
  let s = "";
  for (let i = 0; i < 6; i++) s += abc[bytes[i % bytes.length] % abc.length];
  return `LG-${s}`;
}

/** Lo que escribe el empleado ("lg m4k 2p9", "LGM4K2P9") → "LG-M4K2P9", o null si no parece un código. */
export function normalizeCode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = s.startsWith("LG") && s.length === 8 ? s.slice(2) : s;
  return /^[A-Z0-9]{6}$/.test(body) ? `LG-${body}` : null;
}

/** Código de membresía: "LG-M" + 5 caracteres. */
export function membershipCode(id: string): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = Buffer.from(id, "base64url");
  let s = "";
  for (let i = 0; i < 5; i++) s += abc[bytes[(i + 6) % bytes.length] % abc.length];
  return `LG-M${s}`;
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

/** "Exterior e interior · Camioneta · AAA-000-A". Sin vehículo (lavada de membresía) solo dice el servicio. */
export function serviceText(x: { kind: string; vehicle?: string; plate?: string }): string {
  const v = x.vehicle === "carro" ? "Carro" : x.vehicle === "camioneta" ? "Camioneta" : "";
  return [x.kind === "exterior" ? "Solo exterior" : "Exterior e interior", v, x.plate ?? ""].filter(Boolean).join(" · ");
}

/* ───────── Pago dentro de Mercado Pago (Checkout Pro) ───────── */
/**
 * Preferencia de Checkout Pro: el cliente paga en Mercado Pago con su cuenta (tarjetas guardadas o saldo).
 * El monto es el que guardó el servidor; vence cuando vence el apartado; sin OXXO ni efectivo (quedarían
 * "pendientes" días) y binary_mode: solo aprobado o rechazado.
 */
export function checkoutPreference(o: { id: string; code: string; amount: number; title: string; returnUrl: string; expiresAt: Date }, site: string) {
  return {
    items: [{ id: o.code, title: o.title.slice(0, 120), quantity: 1, unit_price: o.amount, currency_id: "MXN" }],
    external_reference: o.id,
    notification_url: `${site}/api/mp/webhook`,
    back_urls: { success: o.returnUrl, pending: o.returnUrl, failure: o.returnUrl },
    auto_return: "approved",
    binary_mode: true,
    expires: true,
    expiration_date_to: o.expiresAt.toISOString().replace("Z", "+00:00"),
    payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }], installments: 1 },
    statement_descriptor: "LUXE GARAGE",
    metadata: { code: o.code },
  };
}

/**
 * Qué hacer con un pago consultado a la API de Mercado Pago (webhook o regreso de Checkout Pro).
 * Nunca se confía en lo que diga la URL: solo en el pago leído de la API.
 */
export function paymentDecision(pay: { status: string; external_reference?: string; transaction_amount?: number }, target: { id: string; amount: number } | null): "confirm" | "pending" | "mismatch" | "ignore" {
  if (!target || pay.external_reference !== target.id) return "ignore";
  if (pay.status === "approved") return Number(pay.transaction_amount) === target.amount ? "confirm" : "mismatch";
  if (pay.status === "in_process" || pay.status === "pending") return "pending";
  return "ignore";
}

/** "martes 4 de noviembre" → "Martes 4 de noviembre" (solo la primera letra). */
export const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ───────── Ticket para guardar en el celular ───────── */
/** Lo que lleva la imagen del ticket. Sin teléfono, correo ni dirección; el nombre abreviado. */
export type TicketData = { tone: "gold" | "cyan"; kicker: string; code: string; rows: { label: string; value: string }[]; washes: { day: string; time: string }[]; total: string };

export function bookingTicket(b: {
  code: string; date: string; time: string; duration: number; kind: string; vehicle?: string; place: string; amount: number; name: string; membershipCode?: string;
}, location: string): TicketData {
  return {
    tone: "gold", kicker: "Reserva", code: b.code,
    rows: [
      { label: "Cuándo", value: capFirst(fmtDay(b.date)) },
      { label: "Hora", value: fmtRange(b.time, b.duration) },
      { label: "Servicio", value: serviceText({ kind: b.kind, vehicle: b.vehicle }) },
      { label: "Dónde", value: b.place === "domicilio" ? "A domicilio" : location },
      { label: "A nombre de", value: maskName(b.name) },
    ],
    washes: [],
    total: b.membershipCode ? `Incluida en membresía ${b.membershipCode}` : `$${b.amount} pagado`,
  };
}


/** Enmascara datos personales para logs/vistas públicas: 55****6823, j***@dominio.com. */
export function maskPhone(p: string) { const d = p.replace(/\D/g, ""); return d.length < 6 ? "****" : `${d.slice(0, 2)}****${d.slice(-4)}`; }
export function maskName(n: string) { const [first, ...rest] = n.trim().split(/\s+/); return [first, ...rest.map((r) => `${r[0]}.`)].join(" "); }

/* ───────── Socios: suscripción mensual con cuenta (celular + NIP) ───────── */
/** Turno de los socios (lavado completo). */
export const MEMBER_DUR = 30;
/** Cambiar o cancelar una lavada de socio: solo con más de 72 h de anticipación. */
export const CHANGE_LIMIT_H = 72;

/** "2026-01-31" + 1 mes → "2026-02-28" (si el mes no tiene ese día, el último del mes). */
export function addMonths(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1, 12));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0, 12)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}

/** Minutos que faltan para un turno (negativo si ya empezó). */
export const minutesUntil = (date: string, time: string, now: Now) => daysBetween(now.date, date) * 1440 + toMin(time) - now.minutes;

/** ¿Todavía se puede cambiar o cancelar? (más de 72 h antes) */
export const canChange = (date: string, time: string, now: Now) => minutesUntil(date, time, now) > CHANGE_LIMIT_H * 60;

/** Celular de México a 10 dígitos (quita +52, 52, 1, espacios y guiones). null si no es válido. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("521")) d = d.slice(3);
  else if (d.length === 12 && d.startsWith("52")) d = d.slice(2);
  return /^\d{10}$/.test(d) ? d : null;
}

/** NIP de 4 dígitos que no sea obvio (0000, 1111, 1234, 4321…). */
export function nipError(nip: string): string | null {
  if (!/^\d{4}$/.test(nip)) return "El NIP son 4 números.";
  if (/^(\d)\1{3}$/.test(nip) || ["1234", "4321", "0123", "9876", "1212", "6789"].includes(nip)) return "Ese NIP es muy fácil de adivinar. Elige otro.";
  return null;
}

/** Código del socio: "LG-S" + 5 caracteres (sin 0/O/1/I). */
export function memberCode(id: string): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = Buffer.from(id, "base64url");
  let s = "";
  for (let i = 0; i < 5; i++) s += abc[bytes[(i + 3) % bytes.length] % abc.length];
  return `LG-S${s}`;
}

export type MemberStatus = "pending" | "active" | "cancelled" | "expired";
/** ¿Está vigente hoy? Activo (o cancelado pero con su mes ya pagado) y hoy dentro del periodo. */
export const memberValid = (m: { status: MemberStatus; periodStart?: string; periodEnd?: string }, today: string) =>
  (m.status === "active" || m.status === "cancelled") && !!m.periodStart && !!m.periodEnd && today >= m.periodStart && today < m.periodEnd;

/**
 * ¿Puede el socio apartar esa fecha? Solo dentro de su mes pagado (desde hoy) y si le quedan lavadas.
 * `used` = lavadas apartadas o usadas en el periodo actual (las canceladas a tiempo no cuentan).
 */
export function memberBookingError(m: { status: MemberStatus; periodStart?: string; periodEnd?: string; perPeriod: number; used: number }, date: string, today: string): string | null {
  if (!memberValid(m, today)) return "Tu membresía no está vigente. Renueva para apartar.";
  if (!isDateStr(date) || date < today) return "Elige una fecha de hoy en adelante.";
  if (date >= m.periodEnd!) return `Tu mes pagado termina el ${fmtDay(addDays(m.periodEnd!, -1))}. Esa fecha ya no entra.`;
  if (m.used >= m.perPeriod) return `Ya apartaste tus ${m.perPeriod} lavadas de este mes.`;
  return null;
}

/** "16:00", 30 → "4:00–4:30" (corto, para el letrero y los botones). */
export function rangeShort(time: string, dur: number): string {
  const a = toMin(time), b = a + dur;
  const f = (x: number) => `${Math.floor(x / 60) % 12 || 12}:${pad(x % 60)}`;
  return `${f(a)}–${f(b)}`;
}

/* ───────── Cobro automático (Mercado Pago "preapproval") → meses pagados ───────── */
/** Cuántos meses ha cobrado Mercado Pago de esa suscripción (null si no lo informa). */
export function chargedMonths(pre: { summarized?: { charged_quantity?: number | null } | null }): number | null {
  const q = pre.summarized?.charged_quantity;
  return typeof q === "number" && Number.isFinite(q) && q >= 0 ? Math.floor(q) : null;
}

/** Mes vigente según lo cobrado: cada cobro aprobado = 1 mes desde el día del primer cobro (anchor). */
export function periodFromCharges(anchor: string, charged: number): { periodStart: string; periodEnd: string } | null {
  if (charged < 1) return null;
  return { periodStart: addMonths(anchor, charged - 1), periodEnd: addMonths(anchor, charged) };
}

/**
 * Estado del socio a partir de la suscripción de Mercado Pago y de lo cobrado.
 * - Sin ningún cobro aprobado: "pending" (aún no entra, aunque haya autorizado la tarjeta).
 * - Suscripción activa en MP: "active". Pausada o cancelada: "cancelled" (puede usar lo ya pagado).
 */
export function memberStatusFrom(preStatus: string | undefined, charged: number): MemberStatus {
  if (charged < 1) return "pending";
  return preStatus === "authorized" ? "active" : "cancelled";
}
