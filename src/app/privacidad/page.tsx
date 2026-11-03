import { BUSINESS } from "@/lib/config";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aviso de privacidad | LUXE GARAGE" };

// Estructura base conforme a la LFPDPPP (2025). El texto final debe revisarlo un abogado.
export default function Privacidad() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 text-lg leading-relaxed text-white/85">
      <a href="/" className="font-display text-sm tracking-[.25em] text-gold">← LUXE GARAGE</a>
      <h1 className="font-display mt-6 text-4xl font-semibold text-white">Aviso de privacidad</h1>
      <p className="mt-2 text-sm text-amber-300">Versión preliminar: pendiente de revisión legal.</p>
      <h2 className="mt-8 text-xl font-bold text-white">Responsable</h2>
      <p>{BUSINESS.name}, {BUSINESS.location}. Contacto: +{BUSINESS.phone}.</p>
      <h2 className="mt-8 text-xl font-bold text-white">Datos que recabamos</h2>
      <p>Nombre, teléfono, correo, placas (opcional), dirección (solo si eliges servicio a domicilio) y notas que nos dejes. No recabamos datos sensibles. Los datos de tu tarjeta los procesa Mercado Pago; nosotros nunca los vemos ni los guardamos.</p>
      <h2 className="mt-8 text-xl font-bold text-white">Para qué los usamos</h2>
      <p>Finalidad necesaria: agendar, cobrar y realizar tu servicio, y contactarte sobre tu reserva. No los usamos para publicidad sin tu consentimiento por separado.</p>
      <h2 className="mt-8 text-xl font-bold text-white">Con quién los compartimos</h2>
      <p>Mercado Pago (cobro) y nuestros proveedores de hospedaje y base de datos (Vercel y Upstash), solo para prestar el servicio.</p>
      <h2 className="mt-8 text-xl font-bold text-white">Tus derechos ARCO</h2>
      <p>Puedes pedir acceso, rectificación, cancelación u oposición al tratamiento de tus datos llamando o escribiendo al +{BUSINESS.phone}. Respondemos en un máximo de 20 días hábiles.</p>
      <h2 className="mt-8 text-xl font-bold text-white">Conservación</h2>
      <p>Guardamos tus datos mientras sean necesarios para el servicio y obligaciones legales; después se eliminan o anonimizan.</p>
    </main>
  );
}
