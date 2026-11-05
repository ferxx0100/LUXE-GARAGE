"use client";
import { useState } from "react";
import { openReserve } from "./ReserveSheet";
import { SIZE_TAG, VEHICLES, type Service, type Vehicle } from "./fmt";

// Qué incluye cada lavado, dicho fácil (lista del dueño, 5-nov-2026).
const MENU: { s: Service; name: string; short: string; items: string[] }[] = [
  {
    s: "sencillo", name: "Lavado sencillo", short: "Por fuera y por dentro, rápido.",
    items: ["Lavado por fuera con shampoo", "Rines y llantas", "Aspirado de interiores", "Tablero, paneles y cristales", "Aromatizante"],
  },
  {
    s: "profundo", name: "Lavado profundo", short: "Todo lo del sencillo, a fondo.",
    items: ["Todo lo del lavado sencillo", "Cristales sin manchas pegadas (sarro y grasa)", "Plásticos renovados: se ven como nuevos", "Rines sin polvo de freno pegado", "Tolvas (por dentro de las salpicaderas) a fondo", "Rincones y molduras a detalle"],
  },
  {
    s: "detallado", name: "Detallado exterior", short: "La pintura como nueva.",
    items: ["Lavado y preparación de la pintura", "Pintura sin manchas pegadas (descontaminada)", "Pulido con máquina", "Abrillantado", "Encerado y protección final"],
  },
];

/** Tres lavados sin membresía: eliges tamaño (S/M/XL) y ves los tres precios; "Qué incluye" se abre si quieres. */
export default function WashMenu({ prices }: { prices: Record<Service, Record<Vehicle, number>> }) {
  const [v, setV] = useState<Vehicle>("carro");
  const [open, setOpen] = useState<Service | null>(null);
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 rounded-2xl bg-white/[.06] p-1" role="radiogroup" aria-label="Tamaño">
        {VEHICLES.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={v === k} onClick={() => setV(k)}
            className={`min-h-12 rounded-xl px-1 text-[15px] font-semibold leading-tight transition ${v === k ? "bg-gold text-ink shadow" : "text-white/70"}`}>
            <span className="num block text-xs opacity-80">{SIZE_TAG[k]}</span>{k === "suv" ? "SUV / pick up" : k === "camioneta" ? "Camioneta" : "Carro"}
          </button>
        ))}
      </div>
      {MENU.map((m) => {
        const top = m.s === "detallado";
        return (
          <article key={m.s} className={`rounded-2xl border p-4 ${top ? "border-gold/50 bg-[linear-gradient(155deg,#241c09,#0f0e0b_60%)]" : "border-white/10 bg-white/[.03]"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className={`text-lg font-semibold ${top ? "text-gold" : "text-white"}`}>{m.name}</h3>
                <p className="text-sm text-white/60">{m.short}</p>
              </div>
              <p className="num shrink-0 text-xl font-bold text-white">${prices[m.s][v].toLocaleString("es-MX")}</p>
            </div>
            {open === m.s && (
              <ul className="mt-3 grid gap-1.5 text-[15px] text-white/80">
                {m.items.map((t) => <li key={t} className="flex gap-2.5"><span className={`mt-2 size-1.5 shrink-0 rounded-full ${top ? "bg-gold" : "bg-white/50"}`} aria-hidden />{t}</li>)}
              </ul>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOpen(open === m.s ? null : m.s)} aria-expanded={open === m.s}
                className="min-h-11 rounded-xl border border-white/15 text-sm font-semibold text-white/80">{open === m.s ? "Cerrar" : "Qué incluye"}</button>
              <button type="button" onClick={() => openReserve({ service: m.s, vehicle: v })}
                className={`min-h-11 rounded-xl text-sm font-bold ${top ? "btn-gold" : "btn-line"}`}>Reservar</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
