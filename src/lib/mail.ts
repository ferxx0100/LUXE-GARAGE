// Correos transaccionales con Resend (API REST, sin dependencias).
// Variables en Vercel: RESEND_API_KEY (Secret), MAIL_FROM ("LUXE GARAGE <reservas@luxegaragee.com>"),
// MAIL_TO_ADMIN (correo del negocio). Sin RESEND_API_KEY no se envía nada y la reserva sigue normal.
import { fmtDay, fmtRange, fromMin, serviceText, toMin } from "./booking-core";
import type { Booking } from "./bookings";
import { BUSINESS, SITE_URL, mapsLink } from "./config";
import type { Member } from "./members";

const BASE = process.env.MAIL_API_BASE ?? "https://api.resend.com"; // MAIL_API_BASE: solo pruebas locales
export const mailConfigured = () => !!process.env.RESEND_API_KEY;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const site = () => process.env.SITE_URL ?? SITE_URL;
const dur = (b: { duration?: number }) => b.duration ?? 60;
/** "lunes 3 de noviembre · 4:00 pm – 4:30 pm" */
const when = (date: string, time: string, minutes: number) => `${fmtDay(date)} · ${fmtRange(time, minutes)}`;

/* ───────── Archivo de calendario (.ics) ───────── */
type CalEvent = { uid: string; date: string; time: string; duration: number; summary: string; location: string; description: string };
const icsEsc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, " ");
const icsAt = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;

/** Calendario con uno o varios eventos (alarma 1 h antes en cada uno). */
export function icsCalendar(events: CalEvent[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const tz = BUSINESS.timezone;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LUXE GARAGE//Reservas//ES", "METHOD:PUBLISH",
    ...events.flatMap((e) => [
      "BEGIN:VEVENT", `UID:${e.uid}@luxegaragee.com`, `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${tz}:${icsAt(e.date, e.time)}`, `DTEND;TZID=${tz}:${icsAt(e.date, fromMin(Math.min(toMin(e.time) + e.duration, 1439)))}`,
      `SUMMARY:${icsEsc(e.summary)}`, `LOCATION:${icsEsc(e.location)}`, `DESCRIPTION:${icsEsc(e.description)}`,
      "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Tu lavado en LUXE GARAGE es en 1 hora", "END:VALARM",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ].join("\r\n");
}

export function icsFor(b: Booking): string {
  return icsCalendar([{
    uid: b.code, date: b.date, time: b.time, duration: dur(b),
    summary: `Lavado LUXE GARAGE · ${b.code}`,
    location: b.place === "domicilio" ? `A domicilio: ${b.address}` : BUSINESS.location,
    description: `Reserva ${b.code}. Ver: ${site()}/reserva/${b.id} · Ayuda: +${BUSINESS.phone}`,
  }]);
}

/* ───────── Plantilla ───────── */
/** Plantilla negro/oro, tablas simples para que se vea bien en Gmail, Outlook y iPhone. */
function layout(title: string, inner: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#09090a;font-family:Helvetica,Arial,sans-serif;color:#f4f1e8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#09090a;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#121214;border:1px solid #3b331d;border-radius:20px">
<tr><td align="center" style="padding:28px 24px 8px"><img src="${site()}/brand/emblem-128.png" width="64" height="64" alt="LUXE GARAGE" style="display:block">
<p style="margin:12px 0 0;font-family:Georgia,serif;letter-spacing:6px;color:#d4af37;font-size:15px">LUXE GARAGE</p></td></tr>
<tr><td style="padding:8px 28px 4px"><h1 style="margin:16px 0 0;font-family:Georgia,serif;font-size:26px;line-height:1.25;color:#fff">${esc(title)}</h1></td></tr>
${inner}
<tr><td style="padding:20px 28px 28px;font-size:13px;line-height:1.5;color:#9a978f">¿Dudas o cambios? Llámanos o escríbenos al +${BUSINESS.phone}.<br>${esc(BUSINESS.location)}</td></tr>
</table></td></tr></table></body></html>`;
}

const service = serviceText;

function rows(b: Booking): string {
  const r = (k: string, v: string) => `<tr><td style="padding:8px 0;color:#9a978f;font-size:14px;width:110px">${k}</td><td style="padding:8px 0;font-size:16px;font-weight:bold;color:#fff">${v}</td></tr>`;
  return `<tr><td style="padding:16px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px dashed #3b331d;border-bottom:1px dashed #3b331d">
${r("Código", `<span style="font-family:Georgia,serif;font-size:22px;letter-spacing:2px;color:#d4af37">${esc(b.code)}</span>`)}
${r("Cuándo", esc(when(b.date, b.time, dur(b))))}
${r("Servicio", esc(service(b)))}
${r("Dónde", b.place === "domicilio" ? `A domicilio: ${esc(b.address)}` : esc(BUSINESS.location))}
${r("Total", `<span style="color:#d4af37;font-size:20px">$${b.amount} MXN</span>`)}
</table></td></tr>`;
}

const button = (href: string, text: string, gold = true) =>
  `<a href="${href}" style="display:inline-block;margin:6px 4px;padding:14px 22px;border-radius:999px;font-weight:bold;font-size:15px;text-decoration:none;${gold ? "background:#d4af37;color:#0b0b0b" : "border:1px solid #d4af37;color:#d4af37"}">${text}</a>`;

async function send(msg: { to: string; subject: string; html: string; text: string; reply_to?: string; attachments?: { filename: string; content: string }[] }) {
  if (!mailConfigured()) return;
  const r = await fetch(`${BASE}/emails`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM ?? "LUXE GARAGE <reservas@luxegaragee.com>", ...msg }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`mail ${r.status}`);
}

/** Confirmación al cliente (con la cita adjunta) + aviso al negocio. Nunca rompe la reserva si falla. */
export async function sendBookingConfirmed(b: Booking): Promise<void> {
  const link = `${site()}/reserva/${b.id}`;
  const maps = mapsLink;
  const html = layout("¡Tu lavado está reservado!", `
<tr><td style="padding:8px 28px 0;font-size:16px;line-height:1.5;color:#e9e6dd">Hola ${esc(b.name.split(" ")[0])}, tu pago fue aprobado. Muestra tu código al llegar.</td></tr>
${rows(b)}
<tr><td align="center" style="padding:4px 20px">${button(link, "Ver mi reserva")}${button(`${site()}/api/booking/${b.id}/ticket`, "Guardar ticket", false)}${b.place === "garage" ? button(maps, "Cómo llegar", false) : ""}</td></tr>
<tr><td style="padding:12px 28px 0;font-size:13px;color:#9a978f">Adjuntamos tu cita: ábrela para agregarla a tu calendario (te avisa 1 hora antes).</td></tr>`);
  const text = `¡Tu lavado está reservado! Código ${b.code}. ${when(b.date, b.time, dur(b))}. Total $${b.amount}. Ver: ${link}`;
  const ics = Buffer.from(icsFor(b)).toString("base64");
  const jobs: Promise<void>[] = b.email
    ? [send({ to: b.email, subject: `Reserva confirmada ${b.code} · ${when(b.date, b.time, dur(b))}`, html, text, attachments: [{ filename: `${b.code}.ics`, content: ics }] })]
    : [];
  const admin = process.env.MAIL_TO_ADMIN;
  if (admin) {
    const ahtml = layout(`Nueva reserva pagada · ${fmtRange(b.time, dur(b))}`, `${rows(b)}
<tr><td style="padding:0 28px;font-size:16px;line-height:1.6;color:#e9e6dd">👤 ${esc(b.name)}<br>📞 ${esc(b.phone)}${b.email ? `<br>✉️ ${esc(b.email)}` : ""}${b.notes ? `<br>📝 ${esc(b.notes)}` : ""}</td></tr>
<tr><td align="center" style="padding:12px 20px">${button(`${site()}/admin`, "Abrir agenda")}</td></tr>`);
    jobs.push(send({ to: admin, subject: `🟢 Nueva reserva ${b.code} · ${when(b.date, b.time, dur(b))} · $${b.amount}`, html: ahtml, text: `Nueva reserva ${b.code} ${when(b.date, b.time, dur(b))}`, ...(b.email ? { reply_to: b.email } : {}) }));
  }
  const res = await Promise.allSettled(jobs);
  if (res.some((x) => x.status === "rejected")) console.error("correo: no se pudo enviar", b.code);
}

export async function sendBookingCancelled(b: Booking): Promise<void> {
  if (!b.email) return;
  const html = layout("Tu reserva fue cancelada", `${rows(b)}
<tr><td style="padding:0 28px;font-size:15px;line-height:1.5;color:#e9e6dd">Si ya habías pagado, el reembolso se hace a tu mismo medio de pago. Cualquier duda, llámanos.</td></tr>
<tr><td align="center" style="padding:12px 20px">${button(`${site()}/#reservar`, "Reservar otro horario")}</td></tr>`);
  await send({ to: b.email, subject: `Reserva cancelada ${b.code}`, html, text: `Tu reserva ${b.code} fue cancelada.` }).catch(() => console.error("correo: cancelación no enviada", b.code));
}

/** Socio nuevo: bienvenida (nunca el NIP) + aviso al negocio. Nunca rompe el alta si falla. */
export async function sendMemberWelcome(m: Member): Promise<void> {
  const link = `${site()}/socio`;
  const html = layout("¡Ya eres socio!", `
<tr><td style="padding:8px 28px 0;font-size:16px;line-height:1.5;color:#e9e6dd">Hola ${esc(m.name.split(" ")[0])}. Tu membresía está activa: ${m.perPeriod} lavadas completas cada mes. Entra con tu celular y tu NIP para apartar tus lavadas.</td></tr>
<tr><td style="padding:16px 28px"><span style="font-family:Georgia,serif;font-size:22px;letter-spacing:2px;color:#d4af37">${esc(m.code)}</span>${m.periodEnd ? `<br><span style="color:#9a978f;font-size:14px">Tu mes pagado termina el ${esc(fmtDay(m.periodEnd))}. Se renueva solo.</span>` : ""}</td></tr>
<tr><td align="center" style="padding:4px 20px">${button(link, "Entrar a mi cuenta")}</td></tr>`);
  const jobs: Promise<void>[] = m.email ? [send({ to: m.email, subject: `Bienvenido a LUXE GARAGE · Socio ${m.code}`, html, text: `Ya eres socio de LUXE GARAGE (${m.code}). Entra: ${link}` })] : [];
  const admin = process.env.MAIL_TO_ADMIN;
  if (admin) {
    jobs.push(send({ to: admin, subject: `Nuevo socio ${m.code} · ${m.vehicle} · $${m.price}/mes`, html: layout(`Nuevo socio · $${m.price} al mes`, `<tr><td style="padding:8px 28px;font-size:16px;line-height:1.6;color:#e9e6dd">${esc(m.name)}<br>${esc(m.phone)}<br>${m.vehicle === "carro" ? "Carro" : "Camioneta"}</td></tr>`), text: `Nuevo socio ${m.code}` }));
  }
  const res = await Promise.allSettled(jobs);
  if (res.some((x) => x.status === "rejected")) console.error("correo: bienvenida de socio no enviada", m.code);
}
