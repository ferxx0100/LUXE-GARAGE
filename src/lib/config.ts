// Datos fijos del negocio. Precios, horario y avisos viven en src/lib/settings.ts (editables en /admin).
export const BUSINESS = {
  name: "LUXE GARAGE",
  tagline: "Auto Detailing & Car Care",
  phone: "525665006823", // +52 56 6500 6823
  phoneDisplay: "56 6500 6823",
  location: "Las Palomas, Zamora, Michoacán",
  timezone: "America/Mexico_City",
  slotMinutes: 60,
  holdMinutes: 15,
} as const;

export function whatsappLink(text: string): string {
  return `https://wa.me/${BUSINESS.phone}?text=${encodeURIComponent(text)}`;
}

export const telLink = `tel:+${BUSINESS.phone}`;
export const mapsLink = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("LUXE GARAGE Las Palomas Zamora Michoacán");
