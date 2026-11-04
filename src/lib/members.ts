// Socios: suscripción mensual con cuenta (celular + NIP de 4 dígitos).
// Reglas (CLAUDE.md): 4 lavadas completas por mes PAGADO; aparta día y hora cuando quiera dentro de su mes;
// cambiar o cancelar solo con más de 72 h; si no llega, la pierde; si no paga, queda vencido.
import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  canChange, CELL, cellsFor, chargedMonths, dayWindow, fits, fromMin, isTimeStr, MEMBER_DUR, memberBookingError, memberCode,
  memberStatusFrom, memberValid, nipError, normalizePhone, periodFromCharges, shortCode, toMin, type MemberStatus, type Vehicle,
} from "./booking-core";
import { serverKey } from "./auth";
import { getBooking, getBookings, indexCode, saveIndexed, startAllowed, todayCtx, type Booking } from "./bookings";
import { toPublic } from "./garage-state";
import { cancelPreapproval, createSubscription, getPreapproval, type MpAuthorizedPayment, type MpPreapproval } from "./payments/mercadopago";
import { getSettings } from "./settings";
import { claimCells, kvGet, kvIncr, kvSet, redis, releaseCells } from "./store";

export interface Member {
  id: string; code: string; name: string; phone: string; email: string; vehicle: Vehicle;
  /** Huella scrypt del NIP ("sal:hash"); nunca el NIP. */
  nip: string;
  /** Cambia al restablecer el NIP: cierra las sesiones abiertas. */
  nipVer: number;
  status: MemberStatus; price: number; perPeriod: number;
  /** Día del primer cobro aprobado: los meses se cuentan desde ahí. */
  anchor?: string; periodStart?: string; periodEnd?: string;
  preapprovalId?: string;
  /** Cobros aprobados que nos avisó el webhook (respaldo si Mercado Pago no informa el total). */
  charges?: number;
  bookingIds: string[];
  createdAt: string; updatedAt: string;
}

type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };
const fail = (status: number, error: string) => ({ ok: false as const, status, error });

const mk = (id: string) => `lg:mem:${id}`;
const phk = (phone: string) => `lg:mem:ph:${phone}`;
const prek = (pre: string) => `lg:mem:pre:${pre}`;
const LIST = "lg:mem:list";
export const isMemberId = (id: string) => /^[A-Za-z0-9_-]{22}$/.test(id);

/* ───────── NIP ───────── */
function hashNip(nip: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(nip, salt, 32, { N: 16384, r: 8, p: 1 }).toString("hex")}`;
}
function nipMatches(nip: string, stored: string): boolean {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  return timingSafeEqual(scryptSync(nip, salt, 32, { N: 16384, r: 8, p: 1 }), Buffer.from(hex, "hex"));
}
/** NIP nuevo al azar (para cuando el dueño lo restablece), que no sea obvio. */
function randomNip(): string {
  for (;;) { const n = String(randomInt(0, 10000)).padStart(4, "0"); if (!nipError(n)) return n; }
}

/* ───────── Guardar y leer ───────── */
export const getMember = (id: string) => (isMemberId(id) ? kvGet<Member>(mk(id)) : Promise.resolve(null));
async function byPhone(phone: string): Promise<Member | null> {
  const id = await redis<string | null>("GET", phk(phone));
  return id ? getMember(id) : null;
}
async function save(m: Member): Promise<Member> {
  const next = { ...m, updatedAt: new Date().toISOString() };
  await kvSet(mk(m.id), next);
  await redis("SET", phk(m.phone), m.id);
  if (m.preapprovalId) await redis("SET", prek(m.preapprovalId), m.id);
  await redis("ZADD", LIST, Date.parse(m.createdAt), m.id);
  return next;
}
export async function listMembers(): Promise<Member[]> {
  const ids = await redis<string[]>("ZRANGE", LIST, 0, -1);
  if (!ids.length) return [];
  const raw = await redis<(string | null)[]>("MGET", ...ids.map(mk));
  return raw.filter(Boolean).map((r) => JSON.parse(r!) as Member);
}

/** Lugares ocupados: socios vigentes + altas en curso (últimos 30 min). */
async function seatsTaken(today: string, except?: string): Promise<number> {
  const all = await listMembers();
  const recent = Date.now() - 30 * 60 * 1000;
  return all.filter((m) => m.id !== except && (memberValid(m, today) || (m.status === "pending" && Date.parse(m.updatedAt) > recent))).length;
}
/** ¿Quedan lugares de socio? (lo muestra la página pública) */
export async function seatsLeft(): Promise<number> {
  const c = await todayCtx();
  return Math.max(0, c.s.memberCap - (await seatsTaken(c.now.date)));
}

/* ───────── Sesión del socio (cookie firmada) ───────── */
const COOKIE = "lg_socio";
const TTL = 30 * 24 * 3600;
const sign = (v: string) => createHmac("sha256", serverKey()).update(`socio|${v}`).digest("base64url");
export function memberCookie(m: Member): string {
  const v = `${m.id}.${m.nipVer}.${Math.floor(Date.now() / 1000) + TTL}`;
  return `${COOKIE}=${v}.${sign(v)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL}`;
}
export const clearMemberCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

/** El socio de la cookie (firma, vigencia y versión del NIP), o null. */
export async function memberFromCookie(cookieHeader: string | null | undefined): Promise<Member | null> {
  const raw = (cookieHeader ?? "").split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? "";
  const [id, ver, exp, mac] = raw.split(".");
  if (!id || !ver || !exp || !mac || Number(exp) < Date.now() / 1000) return null;
  const want = sign(`${id}.${ver}.${exp}`);
  if (mac.length !== want.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  const m = await getMember(id);
  return m && String(m.nipVer) === ver ? m : null;
}
export const memberFromRequest = (req: Request) => memberFromCookie(req.headers.get("cookie"));

/* ───────── Entrar: celular + NIP, con límite de intentos ───────── */
const MAX_FAILS = 5, WINDOW = 15 * 60;
export async function login(phoneRaw: string, nip: string, ip: string): Promise<Result<Member>> {
  const phone = normalizePhone(phoneRaw);
  if (!phone || !/^\d{4}$/.test(nip)) return fail(400, "Escribe tu celular (10 dígitos) y tu NIP de 4 números.");
  const kPhone = `lg:rl:soc:ph:${phone}`, kIp = `lg:rl:soc:ip:${ip}`;
  const [fp, fi] = await Promise.all([redis<string | null>("GET", kPhone), redis<string | null>("GET", kIp)]);
  if (Number(fp ?? 0) >= MAX_FAILS || Number(fi ?? 0) >= MAX_FAILS * 6) return fail(429, "Demasiados intentos. Espera 15 minutos o toca Ayuda.");
  const m = await byPhone(phone);
  if (!m || !nipMatches(nip, m.nip)) {
    await Promise.all([kvIncr(kPhone, WINDOW), kvIncr(kIp, WINDOW)]);
    return fail(401, "Celular o NIP incorrecto.");
  }
  await redis("DEL", kPhone);
  return { ok: true, value: m };
}

/* ───────── Alta: datos → pago con tarjeta (suscripción) ───────── */
export const SignupInput = z.object({
  vehicle: z.enum(["carro", "camioneta"]),
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  phone: z.string().trim().max(25),
  nip: z.string().trim(),
});

/** Paso 1: guarda los datos (sin cobrar todavía). Revisa tope, celular repetido y NIP. */
export async function startSignup(input: z.infer<typeof SignupInput>): Promise<Result<Member>> {
  const phone = normalizePhone(input.phone);
  if (!phone) return fail(400, "Escribe tu celular a 10 dígitos.");
  const bad = nipError(input.nip);
  if (bad) return fail(400, bad);
  const c = await todayCtx();
  const existing = await byPhone(phone);
  // Una cuenta ya pagada (aunque esté vencida) solo se renueva entrando con su NIP: nadie se la puede quitar.
  if (existing && existing.status !== "pending") return fail(409, "Ese celular ya tiene cuenta. Entra con tu NIP para renovar.");
  if (c.s.memberCap - (await seatsTaken(c.now.date, existing?.id)) <= 0) return fail(409, "Por ahora no hay lugares de socio. Vuelve pronto.");
  const now = new Date().toISOString();
  const id = existing?.id ?? randomBytes(16).toString("base64url");
  const m: Member = {
    id, code: memberCode(id), name: input.name, phone, email: existing?.email ?? "", vehicle: input.vehicle,
    nip: hashNip(input.nip), nipVer: (existing?.nipVer ?? 0) + 1,
    status: "pending", price: c.s.socio[input.vehicle], perPeriod: c.s.membershipWashes,
    bookingIds: existing?.bookingIds ?? [], createdAt: existing?.createdAt ?? now, updatedAt: now,
  };
  return { ok: true, value: await save(m) };
}

/** Paso 2: con el token de tarjeta del Brick, crea el cobro automático mensual en Mercado Pago. */
export async function subscribe(m: Member, cardToken: string, email: string): Promise<Result<Member>> {
  if (memberValid(m, (await todayCtx()).now.date) && m.status === "active") return { ok: true, value: m };
  const s = await getSettings();
  const amount = s.socio[m.vehicle]; // el precio de hoy, del servidor
  const pre = await createSubscription({ memberId: m.id, email, amount, cardToken, reason: `LUXE GARAGE · Socio ${m.vehicle === "carro" ? "carro" : "camioneta"} · ${s.membershipWashes} lavadas al mes` });
  // Suscripción nueva (alta o renovación después de vencer): los meses se cuentan desde su primer cobro.
  const fresh = pre.id !== m.preapprovalId ? { anchor: undefined, charges: 0, periodStart: undefined, periodEnd: undefined } : {};
  const next = await save({ ...m, ...fresh, email, price: amount, perPeriod: s.membershipWashes, preapprovalId: pre.id });
  if (pre.status !== "authorized" && pre.status !== "pending") return fail(402, "Tu banco no autorizó el cobro. Intenta con otra tarjeta.");
  return { ok: true, value: await applyPreapproval(next, pre) };
}

/* ───────── Mantener al día lo que cobró Mercado Pago ───────── */
/** Aplica el estado de la suscripción: meses cobrados → mes vigente; activa, cancelada o pendiente. */
async function applyPreapproval(m: Member, pre: MpPreapproval): Promise<Member> {
  const charged = Math.max(chargedMonths(pre) ?? 0, m.charges ?? 0);
  const today = (await todayCtx()).now.date;
  const anchor = m.anchor ?? (charged >= 1 ? today : undefined);
  const period = anchor ? periodFromCharges(anchor, charged) : null;
  const status = memberStatusFrom(pre.status, charged);
  const next: Member = { ...m, status: period && !memberValid({ status, ...period }, today) && status === "cancelled" ? "expired" : status, anchor, ...(period ?? {}) };
  return save(next);
}

/** Vuelve a leer la suscripción en Mercado Pago (al ver su cuenta y desde el webhook). Si falla, deja lo guardado. */
export async function syncMember(m: Member, force = false): Promise<Member> {
  if (!m.preapprovalId) return m;
  const today = (await todayCtx()).now.date;
  // Basta revisar si está pendiente o cerca de renovar; y no más de una vez por minuto.
  const near = !m.periodEnd || m.periodEnd <= today || m.status === "pending";
  if (!force && !near) return m;
  if (!force && (await redis("SET", `lg:mem:sync:${m.id}`, "1", "NX", "EX", 60)) !== "OK") return m;
  try { return await applyPreapproval(m, await getPreapproval(m.preapprovalId)); } catch { return m; }
}

/** Webhook "subscription_preapproval": cambió la suscripción (autorizada, pausada, cancelada). */
export async function onPreapproval(pre: MpPreapproval): Promise<void> {
  const id = (await redis<string | null>("GET", prek(pre.id))) ?? pre.external_reference ?? "";
  const m = await getMember(id);
  if (m) await applyPreapproval({ ...m, preapprovalId: pre.id }, pre);
}

/** Webhook "subscription_authorized_payment": un cobro mensual. Solo cuenta si se aprobó (una vez por cobro). */
export async function onAuthorizedPayment(ap: MpAuthorizedPayment): Promise<void> {
  if (!ap.preapproval_id || ap.payment?.status !== "approved") return;
  const id = await redis<string | null>("GET", prek(ap.preapproval_id));
  const m = id ? await getMember(id) : null;
  if (!m) return;
  if ((await redis("SET", `lg:mem:ap:${ap.id}`, "1", "NX", "EX", 400 * 24 * 3600)) !== "OK") return;
  const counted = { ...m, charges: (m.charges ?? 0) + 1 };
  try { await applyPreapproval(counted, await getPreapproval(ap.preapproval_id)); } catch { await save(counted); }
}

/** El socio cancela: Mercado Pago deja de cobrar; puede usar lo que ya pagó. */
export async function cancelSubscription(m: Member): Promise<Member> {
  if (m.preapprovalId) await cancelPreapproval(m.preapprovalId);
  return save({ ...m, status: m.status === "pending" ? "expired" : "cancelled" });
}

/* ───────── Lavadas del socio ───────── */
export async function memberWashes(m: Member): Promise<Booking[]> {
  const list = await getBookings(m.bookingIds);
  return list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
/** Lavadas que cuentan en su mes actual (apartadas o usadas; las canceladas a tiempo no). */
export const usedThisPeriod = (m: Member, list: Booking[]) =>
  list.filter((b) => b.status !== "cancelled" && !!m.periodStart && !!m.periodEnd && b.date >= m.periodStart && b.date < m.periodEnd).length;

/**
 * Aparta una lavada del socio. walkIn: "Estoy aquí: lavar ahora" (turno que empieza ya, solo si está LIBRE).
 * Las celdas se fijan de una vez (claimCells es atómico): imposible encimarse con otra reserva.
 */
export async function bookWash(m: Member, date: string, time: string, walkIn = false): Promise<Result<Booking>> {
  const lock = `lg:mem:lock:${m.id}`;
  if ((await redis("SET", lock, "1", "NX", "EX", 15)) !== "OK") return fail(409, "Espera un momento e intenta de nuevo.");
  try {
    const c = await todayCtx();
    const list = await memberWashes(m);
    let day = date, start = toMin(time);
    if (walkIn) {
      day = c.now.date;
      start = Math.floor(c.now.minutes / CELL) * CELL;
      if (toPublic(c.g, c.s.hours).status !== "LIBRE") return fail(409, "Ahorita está ocupado. Aparta el siguiente turno.");
      if (!dayWindow(c.s.hours, day) || !fits(c.s.hours, day, start, MEMBER_DUR, [])) return fail(409, "Ya no alcanza un turno completo hoy. Aparta otro día.");
    } else if (!isTimeStr(time) || !startAllowed(c, date, time, MEMBER_DUR)) {
      return fail(409, "Ese turno ya no está libre. Elige otro.");
    }
    const err = memberBookingError({ ...m, used: usedThisPeriod(m, list) }, day, c.now.date);
    if (err) return fail(409, err);
    const id = randomBytes(16).toString("base64url");
    if (!(await claimCells(cellsFor(day, start, MEMBER_DUR), id))) return fail(409, "Alguien acaba de apartar ese turno. Elige otro.");
    const now = new Date().toISOString();
    const b: Booking = {
      id, code: shortCode(id), status: "confirmed", date: day, time: fromMin(start), duration: MEMBER_DUR,
      kind: "completo", place: "garage", address: "", vehicle: m.vehicle, name: m.name, phone: m.phone, email: m.email,
      plate: "", notes: walkIn ? "Llegó sin reservar" : "", amount: 0, owner: id,
      membershipId: m.id, membershipCode: m.code, paymentStatus: "socio", createdAt: now, updatedAt: now,
    };
    await saveIndexed(b);
    await indexCode(b.code, `b:${id}`);
    await save({ ...m, bookingIds: [...m.bookingIds, id] });
    return { ok: true, value: b };
  } finally {
    await redis("DEL", lock);
  }
}

/** Cancela una lavada del socio: solo con más de 72 h; la lavada regresa a su mes. */
export async function cancelWash(m: Member, bookingId: string): Promise<Result<Booking>> {
  const b = await getBooking(bookingId);
  if (!b || b.membershipId !== m.id || b.status !== "confirmed") return fail(404, "No encontramos esa lavada.");
  const c = await todayCtx();
  if (!canChange(b.date, b.time, c.now)) return fail(409, "Faltan menos de 72 horas: esa lavada ya no se puede cambiar.");
  await releaseCells(cellsFor(b.date, toMin(b.time), b.duration), b.owner ?? b.id);
  const next: Booking = { ...b, status: "cancelled", updatedAt: new Date().toISOString() };
  await kvSet(`lg:bk:${b.id}`, next);
  return { ok: true, value: next };
}

/* ───────── Panel del dueño ───────── */
/** Restablece el NIP (el socio lo olvidó). Devuelve el NIP nuevo UNA vez para dárselo; cierra sus sesiones. */
export async function resetNip(id: string): Promise<{ member: Member; nip: string } | null> {
  const m = await getMember(id);
  if (!m) return null;
  const nip = randomNip();
  return { member: await save({ ...m, nip: hashNip(nip), nipVer: m.nipVer + 1 }), nip };
}

/** Lo que ve el socio de sí mismo (sin la huella del NIP ni ids internos de Mercado Pago). */
export function publicMember(m: Member, today: string) {
  return {
    code: m.code, name: m.name, vehicle: m.vehicle, status: m.status, valid: memberValid(m, today),
    periodStart: m.periodStart ?? null, periodEnd: m.periodEnd ?? null, perPeriod: m.perPeriod, price: m.price,
  };
}
