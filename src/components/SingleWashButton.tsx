"use client";
import { openReserve } from "./ReserveSheet";

/** Abre el mismo calendario de apartar (lavada normal o socio). */
export default function SingleWashButton() {
  return <button type="button" onClick={() => openReserve()} className="btn-line min-h-14 w-full text-lg">Reservar</button>;
}
