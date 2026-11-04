// "Pagar con Mercado Pago": crea (o reutiliza) el link de Checkout Pro de un apartado vigente.
import { fmtDay, fmtTime } from "../booking-core";
import { getBooking, HOLD_SEC, holdStillValid } from "../bookings";
import { SITE_URL } from "../config";
import { redis } from "../store";
import { createPreference, mpConfigured } from "./mercadopago";

type Out = { ok: true; url: string } | { ok: false; status: number; error: string };
type Target = { code: string; amount: number; status: string; createdAt: string; title: string; valid: boolean };

async function target(id: string): Promise<Target | null> {
  const b = await getBooking(id);
  if (!b) return null;
  return { ...b, title: `LUXE GARAGE · Lavado ${fmtDay(b.date)} ${fmtTime(b.time)}`, valid: b.status === "hold" && (await holdStillValid(b)) };
}

/** origin: el sitio desde donde se paga (producción o vista previa de Vercel), para regresar ahí mismo. */
export async function checkoutLink(id: string, origin: string): Promise<Out> {
  if (!mpConfigured()) return { ok: false, status: 503, error: "Los pagos en línea se están activando. Intenta más tarde." };
  const t = await target(id);
  if (!t) return { ok: false, status: 404, error: "No encontramos tu apartado." };
  if (t.status !== "hold") return { ok: false, status: 409, error: "Este apartado ya no está pendiente de pago." };
  const expiresAt = new Date(Date.parse(t.createdAt) + HOLD_SEC * 1000);
  const left = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  if (!t.valid || left < 30) return { ok: false, status: 409, error: "Tu apartado expiró. Elige de nuevo." };

  // Un solo link por apartado (si tocan dos veces, es el mismo).
  const key = `lg:pref:${id}`;
  const cached = await redis<string | null>("GET", key);
  if (cached) return { ok: true, url: cached };

  const site = /^https:\/\/[a-z0-9.-]+$|^http:\/\/localhost(:\d+)?$/.test(origin) ? origin : (process.env.SITE_URL ?? SITE_URL);
  const pref = await createPreference({
    id, code: t.code, amount: t.amount, title: t.title, expiresAt,
    returnUrl: `${site}/reserva/${id}`,
  });
  await redis("SET", key, pref.init_point, "EX", left);
  return { ok: true, url: pref.init_point };
}
