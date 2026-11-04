import { z } from "zod";
import { kvGet, kvSet } from "./store";

const money = z.number().int().min(0).max(100000);
const byVehicle = (carro: number, camioneta: number, suv: number) => z.preprocess(
  (v) => (v && typeof v === "object" && "suv" in v ? v : undefined), // precios viejos de 2 tamaños → los nuevos
  z.object({ carro: money, camioneta: money, suv: money }).default({ carro, camioneta, suv }),
);

// Todo lo que el dueño controla desde /admin. El servidor valida y es la única fuente de precios.
// Claves nuevas (socio/single): los precios viejos guardados (prices: 180/220/555…) se descartan solos.
export const Settings = z.object({
  /** Suscripción mensual (cobro automático): lo principal del negocio. */
  socio: byVehicle(450, 650, 999),
  /** Lavada normal, pagada al apartar (secundaria). */
  single: byVehicle(149, 199, 249),
  /** Lavadas completas por mes pagado. */
  membershipWashes: z.number().int().min(1).max(31).default(4),
  /** Socios activos como máximo (para no sobrevender el horario). */
  memberCap: z.number().int().min(0).max(1000).default(45),
  // Índice 0 = domingo … 6 = sábado; null = cerrado ese día.
  hours: z.array(
    z.object({ open: z.number().int().min(0).max(23), close: z.number().int().min(1).max(24) })
      .refine((d) => d.close > d.open, { message: "El cierre debe ser después de la apertura" })
      .nullable(),
  ).length(7),
  notice: z.string().trim().max(160).default(""),
});
export type Settings = z.infer<typeof Settings>;

// Lunes a viernes 12 pm–7 pm, sábado 11 am–5 pm, domingo cerrado (editable en /admin → Ajustes).
export const DEFAULT_HOURS: Settings["hours"] = [null, { open: 12, close: 19 }, { open: 12, close: 19 }, { open: 12, close: 19 }, { open: 12, close: 19 }, { open: 12, close: 19 }, { open: 11, close: 17 }];
export const DEFAULT_SETTINGS: Settings = Settings.parse({ hours: DEFAULT_HOURS });

const KEY = "lg:settings";

/**
 * Si aún no hay ajustes guardados, usa los valores por defecto.
 * Si el almacén falla, lanza error: así Vercel sigue sirviendo la última página buena
 * en lugar de publicar precios equivocados.
 */
export async function getSettings(): Promise<Settings> {
  const raw = await kvGet<Record<string, unknown>>(KEY);
  const p = Settings.safeParse(raw ?? {});
  if (p.success) return p.data;
  // Horario guardado con otro formato: conserva lo demás y usa el horario por defecto.
  const rest = Settings.safeParse({ ...(raw ?? {}), hours: DEFAULT_HOURS });
  return rest.success ? rest.data : DEFAULT_SETTINGS;
}

export async function saveSettings(s: Settings): Promise<void> {
  await kvSet(KEY, s);
}

export { hoursText as hoursLabel } from "./booking-core";
