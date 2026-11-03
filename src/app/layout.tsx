import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUXE GARAGE | Autolavado & Detailing en Zamora",
  description: "Vienes cuando el garage está libre. Reserva, suscríbete y mira la disponibilidad en tiempo real.",
  icons: { icon: "/brand/emblem.svg" },
};
export const viewport: Viewport = { themeColor: "#09090a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
