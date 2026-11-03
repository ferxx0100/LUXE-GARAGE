// Datos fijos del negocio. Precios, horario y avisos viven en src/lib/settings.ts (editables en /admin).
export const BUSINESS = {
  name: "LUXE GARAGE",
  tagline: "Auto Detailing & Car Care",
  whatsapp: "526566006823",
  location: "Las Palomas, Zamora, Michoacán",
  timezone: "America/Mexico_City",
  slotMinutes: 60,
  holdMinutes: 15,
} as const;

export function whatsappLink(text: string): string {
  return `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(text)}`;
}
