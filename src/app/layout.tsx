import type { Metadata, Viewport } from "next";
import "@fontsource-variable/cinzel";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUXE GARAGE | Autolavado en Zamora — míralo libre en vivo",
  description: "Mira en tiempo real si el garage está libre. Reserva y paga en línea. Dr. Verduzco Sur 1084, Los Laureles, Zamora, Michoacán.",
  metadataBase: new URL("https://luxegaragee.com"),
  openGraph: {
    title: "LUXE GARAGE · Zamora",
    description: "¿Está libre? Míralo en vivo y reserva en línea.",
    images: ["/brand/google/logo-1024.png"],
    locale: "es_MX",
    type: "website",
  },
};
export const viewport: Viewport = { themeColor: "#09090a", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
