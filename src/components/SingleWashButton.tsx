"use client";
import { openReserve } from "./ReserveSheet";
import type { Service } from "./fmt";

/** Abre el calendario de apartar con el servicio de la ficha (sencillo, profundo o detallado). */
export default function SingleWashButton({ service = "sencillo", className = "btn-line min-h-14 w-full text-lg", label = "Reservar" }: { service?: Service; className?: string; label?: string }) {
  return <button type="button" onClick={() => openReserve({ service })} className={className}>{label}</button>;
}
