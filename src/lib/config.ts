// Configuración del negocio. Los precios SIEMPRE se resuelven aquí, en el servidor.
export const BUSINESS = {
  name: "LUXE GARAGE",
  tagline: "Auto Detailing & Car Care",
  whatsapp: "526566006823",
  location: "Las Palomas, Zamora, Michoacán",
  timezone: "America/Mexico_City",
  // 0 = domingo. Horario supuesto: lun–sáb 9:00–19:00 (confirmar con el dueño).
  hours: { open: 9, close: 19, days: [1, 2, 3, 4, 5, 6] },
  slotMinutes: 60,
  holdMinutes: 15,
} as const;

export type VehicleType = "carro" | "camioneta";
export type WashKind = "exterior" | "interior";

export const WASH_PRICE_MXN: Record<VehicleType, number> = { carro: 180, camioneta: 220 };
export const HOME_VISIT_FEE_MXN = 50; // por cada ida a domicilio

export const SUBSCRIPTION = {
  priceMXN: 555,
  washesPerMonth: 6,
} as const;

export function washPrice(vehicle: VehicleType, home: boolean): number {
  return WASH_PRICE_MXN[vehicle] + (home ? HOME_VISIT_FEE_MXN : 0);
}

export function whatsappLink(text: string): string {
  return `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(text)}`;
}
