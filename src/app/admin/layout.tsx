import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel | LUXE GARAGE",
  robots: { index: false, follow: false },
  // En iPhone: Compartir → "Agregar a pantalla de inicio" lo abre como app a pantalla completa.
  appleWebApp: { capable: true, title: "LUXE Panel", statusBarStyle: "black-translucent" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
