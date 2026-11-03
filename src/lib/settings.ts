import { z } from "zod";
import { kvGet, kvSet } from "./store";

const money = z.number().int().min(0).max(100000);

// Todo lo que el dueño controla desde /admin. El servidor valida y es la única fuente de precios.
export const Settings = z.object({
  // suscripcion = precio de la membresía (pago por 30 días).
  prices: z.object({ carro: money, camioneta: money, domicilio: money, suscripcion: money }),
  // Lavadas completas (exterior e interior) que incluye la membresía. Clave nueva: el valor viejo
  // (subscriptionWashes: 6) se descarta y toma el de ahora (4).
  membershipWashes: z.number().int().min(1).max(31).default(4),
  // Índice 0 = domingo … 6 = sábado; null = cerrado ese día.
  hours: z.array(
    z.object({ open: z.number().int().min(0).max(23), close: z.number().int().min(1).max(24) })
      .refine((d) => d.close > d.open, { message: "El cierre debe ser después de la apertura" })
      .nullable(),
  ).length(7),
  notice: z.string().trim().max(160),
});
export type Settings = z.infer<typeof Settings>;

export const DEFAULT_SETTINGS: Settings = {
  prices: { carro: 180, camioneta: 220, domicilio: 100, suscripcion: 555 },
  membershipWashes: 4,
  // Lunes a jueves 12 pm–7 pm · viernes y sábado 1 pm–6 pm · domingo cerrado
  hours: [null, { open: 12, close: 19 }, { open: 12, close: 19 }, { open: 12, close: 19 }, { open: 12, close: 19 }, { open: 13, close: 18 }, { open: 13, close: 18 }],
  notice: "",
};

const KEY = "lg:settings";

/**
 * Si aún no hay ajustes guardados, usa los valores por defecto.
 * Si el almacén falla, lanza error: así Vercel sigue sirviendo la última página buena
 * en lugar de publicar precios equivocados.
 */
export async function getSettings(): Promise<Settings> {
  const raw = await kvGet<Record<string, unknown>>(KEY);
  const p = Settings.safeParse(raw);
  if (p.success) return p.data;
  // Formato anterior (un solo horario para todos los días): conserva precios y aviso, usa el horario nuevo.
  const old = Settings.omit({ hours: true }).safeParse(raw);
  return old.success ? { ...old.data, hours: DEFAULT_SETTINGS.hours } : DEFAULT_SETTINGS;
}

export async function saveSettings(s: Settings): Promise<void> {
  await kvSet(KEY, s);
}

export { hoursText as hoursLabel } from "./booking-core";
