// Datos fijos del negocio. Precios, horario y avisos viven en src/lib/settings.ts (editables en /admin).
export const BUSINESS = {
  name: "LUXE GARAGE",
  tagline: "Auto Detailing & Car Care",
  phone: "525665006823", // +52 56 6500 6823
  phoneDisplay: "56 6500 6823",
  location: "Dr. Verduzco Sur 1084, Los Laureles, 59674 Zamora de Hidalgo, Mich.",
  address: { street: "Dr. Verduzco Sur 1084", colonia: "Los Laureles", cp: "59674", city: "Zamora de Hidalgo", state: "Michoacán" },
  plusCode: "XPJ5+C3 Zamora de Hidalgo, Michoacán",
  // Pin real del negocio en Google Maps (ficha "Luxe Garage").
  geo: { lat: 19.9810063, lng: -102.2922694 },
  mapsCid: "16199733039040388882",
  timezone: "America/Mexico_City",
  slotMinutes: 60,
  holdMinutes: 15,
} as const;

export function whatsappLink(text: string): string {
  return `https://wa.me/${BUSINESS.phone}?text=${encodeURIComponent(text)}`;
}

export const SITE_URL = "https://www.luxegaragee.com"; // dominio principal (luxegaragee.com redirige aquí)

export const telLink = `tel:+${BUSINESS.phone}`;
// Abre la ficha real "Luxe Garage" en Google Maps (con su pin exacto, fotos y reseñas).
export const mapsLink = `https://maps.google.com/?cid=${BUSINESS.mapsCid}`;
