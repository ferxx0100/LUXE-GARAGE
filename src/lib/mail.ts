// Correos transaccionales con Resend (API REST, sin dependencias).
// Variables en Vercel: RESEND_API_KEY (Secret), MAIL_FROM ("LUXE GARAGE <reservas@luxegaragee.com>"),
// MAIL_TO_ADMIN (correo del negocio). Sin RESEND_API_KEY no se envía nada y la reserva sigue normal.
import type { Booking } from "./bookings";
import { BUSINESS, SITE_URL } from "./config";

const BASE = process.env.MAIL_API_BASE ?? "https://api.resend.com"; // MAIL_API_BASE: solo pruebas locales
export const mailConfigured = () => !!process.env.RESEND_API_KEY;

const DAY = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTH = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fmtDate = (d: string) => { const x = new Date(`${d}T12:00:00Z`); return `${DAY[x.getUTCDay()]} ${x.getUTCDate()} de ${MONTH[x.getUTCMonth()]}`; };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const site = () => process.env.SITE_URL ?? SITE_URL;

export function icsFor(b: Booking): string {
  const [y, m, d] = b.date.split("-");
  const [hh, mm] = b.time.split(":");
  const end = `${String(Number(hh) + 1).padStart(2, "0")}${mm}00`;
  const e = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, " ");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LUXE GARAGE//Reservas//ES", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${b.code}@luxegaragee.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;TZID=${BUSINESS.timezone}:${y}${m}${d}T${hh}${mm}00`, `DTEND;TZID=${BUSINESS.timezone}:${y}${m}${d}T${end}`,
    `SUMMARY:${e(`Lavado LUXE GARAGE · ${b.code}`)}`,
    `LOCATION:${e(b.place === "domicilio" ? `A domicilio: ${b.address}` : BUSINESS.location)}`,
    `DESCRIPTION:${e(`Reserva ${b.code}. Ver: ${site()}/reserva/${b.id} · Ayuda: +${BUSINESS.phone}`)}`,
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Tu lavado en LUXE GARAGE es en 1 hora", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

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

function rows(b: Booking): string {
  const r = (k: string, v: string) => `<tr><td style="padding:8px 0;color:#9a978f;font-size:14px;width:110px">${k}</td><td style="padding:8px 0;font-size:16px;font-weight:bold;color:#fff">${v}</td></tr>`;
  return `<tr><td style="padding:16px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px dashed #3b331d;border-bottom:1px dashed #3b331d">
${r("Código", `<span style="font-family:Georgia,serif;font-size:22px;letter-spacing:2px;color:#d4af37">${b.code}</span>`)}
${r("Cuándo", `${esc(fmtDate(b.date))} · ${b.time} h`)}
${r("Servicio", `${b.kind === "exterior" ? "Solo exterior" : "Exterior e interior"} · ${b.vehicle === "carro" ? "Carro" : "Camioneta"}${b.plate ? ` · ${esc(b.plate)}` : ""}`)}
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
  const maps = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("LUXE GARAGE Las Palomas Zamora Michoacán");
  const html = layout("¡Tu lavado está reservado!", `
<tr><td style="padding:8px 28px 0;font-size:16px;line-height:1.5;color:#e9e6dd">Hola ${esc(b.name.split(" ")[0])}, tu pago fue aprobado. Muestra tu código al llegar.</td></tr>
${rows(b)}
<tr><td align="center" style="padding:4px 20px">${button(link, "Ver mi reserva")}${b.place === "garage" ? button(maps, "Cómo llegar", false) : ""}</td></tr>
<tr><td style="padding:12px 28px 0;font-size:13px;color:#9a978f">Adjuntamos tu cita: ábrela para agregarla a tu calendario (te avisa 1 hora antes).</td></tr>`);
  const text = `¡Tu lavado está reservado! Código ${b.code}. ${fmtDate(b.date)} ${b.time} h. Total $${b.amount}. Ver: ${link}`;
  const ics = Buffer.from(icsFor(b)).toString("base64");
  const jobs: Promise<void>[] = [
    send({ to: b.email, subject: `Reserva confirmada ${b.code} · ${fmtDate(b.date)} ${b.time}`, html, text, attachments: [{ filename: `${b.code}.ics`, content: ics }] }),
  ];
  const admin = process.env.MAIL_TO_ADMIN;
  if (admin) {
    const ahtml = layout(`Nueva reserva pagada · ${b.time}`, `${rows(b)}
<tr><td style="padding:0 28px;font-size:16px;line-height:1.6;color:#e9e6dd">👤 ${esc(b.name)}<br>📞 ${esc(b.phone)}<br>✉️ ${esc(b.email)}${b.notes ? `<br>📝 ${esc(b.notes)}` : ""}</td></tr>
<tr><td align="center" style="padding:12px 20px">${button(`${site()}/admin`, "Abrir agenda")}</td></tr>`);
    jobs.push(send({ to: admin, subject: `🟢 Nueva reserva ${b.code} · ${b.date} ${b.time} · $${b.amount}`, html: ahtml, text: `Nueva reserva ${b.code} ${b.date} ${b.time} ${b.name}`, reply_to: b.email }));
  }
  const res = await Promise.allSettled(jobs);
  if (res.some((x) => x.status === "rejected")) console.error("correo: no se pudo enviar", b.code);
}

export async function sendBookingCancelled(b: Booking): Promise<void> {
  const html = layout("Tu reserva fue cancelada", `${rows(b)}
<tr><td style="padding:0 28px;font-size:15px;line-height:1.5;color:#e9e6dd">Si ya habías pagado, el reembolso se hace a tu mismo medio de pago. Cualquier duda, llámanos.</td></tr>
<tr><td align="center" style="padding:12px 20px">${button(`${site()}/#reservar`, "Reservar otro horario")}</td></tr>`);
  await send({ to: b.email, subject: `Reserva cancelada ${b.code}`, html, text: `Tu reserva ${b.code} fue cancelada.` }).catch(() => console.error("correo: cancelación no enviada", b.code));
}
