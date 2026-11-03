import { z } from "zod";
import { kvGet, kvSet } from "./store";

const money = z.number().int().min(0).max(100000);

// Todo lo que el dueño controla desde /admin. El servidor valida y es la única fuente de precios.
export const Settings = z.object({
  prices: z.object({ carro: money, camioneta: money, domicilio: money, suscripcion: money }),
  subscriptionWashes: z.number().int().min(1).max(31),
  hours: z
    .object({
      open: z.number().int().min(0).max(23),
      close: z.number().int().min(1).max(24),
      days: z.array(z.number().int().min(0).max(6)).max(7),
    })
    .refine((h) => h.close > h.open, { message: "El cierre debe ser después de la apertura" }),
  notice: z.string().trim().max(160),
});
export type Settings = z.infer<typeof Settings>;

export const DEFAULT_SETTINGS: Settings = {
  prices: { carro: 180, camioneta: 220, domicilio: 50, suscripcion: 555 },
  subscriptionWashes: 6,
  hours: { open: 9, close: 19, days: [1, 2, 3, 4, 5, 6] },
  notice: "",
};

const KEY = "lg:settings";

/**
 * Si aún no hay ajustes guardados, usa los valores por defecto.
 * Si el almacén falla, lanza error: así Vercel sigue sirviendo la última página buena
 * en lugar de publicar precios equivocados.
 */
export async function getSettings(): Promise<Settings> {
  const p = Settings.safeParse(await kvGet(KEY));
  return p.success ? p.data : DEFAULT_SETTINGS;
}

export async function saveSettings(s: Settings): Promise<void> {
  await kvSet(KEY, s);
}

const DAY = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export function hoursLabel(h: Settings["hours"]): string {
  if (!h.days.length) return "Cerrado temporalmente";
  const days = [...h.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const consecutive = days.every((d, i) => i === 0 || d === (days[i - 1] + 1) % 7);
  const span = consecutive && days.length > 2 ? `${DAY[days[0]]}–${DAY[days.at(-1)!]}` : days.map((d) => DAY[d]).join(", ");
  return `${span} · ${h.open}:00–${h.close}:00`;
}
