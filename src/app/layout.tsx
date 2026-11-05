import type { Metadata, Viewport } from "next";
import "@fontsource-variable/cinzel";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUXE GARAGE | Autolavado en Zamora — míralo libre en vivo",
  description: "Mira en tiempo real si el garage está libre. Reserva y paga en línea. Dr. Verduzco Sur 1084, Los Laureles, Zamora, Michoacán.",
  // www es el dominio principal (el otro redirige): WhatsApp y Facebook no siempre siguen redirecciones.
  metadataBase: new URL("https://www.luxegaragee.com"),
  alternates: { canonical: "/" },
  // Imagen para compartir: 1200×630 y ligera (WhatsApp no muestra imágenes de más de ~300 KB).
  openGraph: {
    title: "LUXE GARAGE · Zamora",
    description: "¿Está libre? Míralo en vivo y reserva en línea.",
    url: "/",
    siteName: "LUXE GARAGE",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "LUXE GARAGE · Auto Detailing", type: "image/jpeg" }],
    locale: "es_MX",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "LUXE GARAGE · Zamora", description: "¿Está libre? Míralo en vivo y reserva en línea.", images: ["/og.jpg"] },
};
export const viewport: Viewport = { themeColor: "#09090a", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
