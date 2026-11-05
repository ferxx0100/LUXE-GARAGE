"use client";
import { useState } from "react";
import JoinFlow from "./JoinFlow";
import { VEHICLES, type Vehicle } from "./fmt";

const Check = () => (
  <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m5 12.5 4.2 4.2L19 7" />
  </svg>
);

/** La suscripción como un plan: eliges carro, camioneta o SUV/pick up, ves el precio al mes, qué incluye y un botón. */
export default function PlanCard({ prices, single, washes, mpPublicKey, seats }: {
  prices: Record<Vehicle, number>; single?: Record<Vehicle, number>; washes: number; mpPublicKey: string | null; seats: number;
}) {
  const [v, setV] = useState<Vehicle>("carro");
  const soldOut = seats <= 0;
  const perks = [`${washes} lavadas completas al mes`, "Interior y exterior", "Tú eliges día y hora desde tu celular", "Tarjeta de socio con sello vivo", "Se renueva sola · cancelas cuando quieras"];
  const perWash = Math.round(prices[v] / washes);
  const saving = single && single[v] > perWash ? Math.round((1 - perWash / single[v]) * 100) : 0;

  return (
    <div className="relative overflow-hidden rounded-[28px] p-px text-left shadow-[0_34px_70px_-30px_rgba(212,175,55,.6)] [background:linear-gradient(140deg,#f3dc8a,#8a6a12_35%,#d4af37_60%,#5c470d)]">
    <div className="relative overflow-hidden rounded-[27px] bg-[linear-gradient(160deg,#211a08_0%,#100e0a_50%,#0b0b0c_100%)] p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-gold/15 blur-3xl" aria-hidden />
      <div className="relative flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[.28em] text-gold">Suscripción mensual</p>
        {!soldOut && seats <= 10 && <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">Quedan {seats}</span>}
      </div>
      <h2 className="font-display relative mt-2 text-[2rem] font-semibold leading-tight text-white">Membresía LUXE</h2>

      <div className="relative mt-5 grid grid-cols-3 rounded-2xl bg-white/[.06] p-1" role="radiogroup" aria-label="Vehículo">
        {VEHICLES.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={v === k} onClick={() => setV(k)}
            className={`min-h-12 rounded-xl px-1 text-[15px] font-semibold leading-tight transition ${v === k ? "bg-gold text-ink shadow" : "text-white/70"}`}>
            {k === "suv" ? "SUV / pick up" : k === "camioneta" ? "Camioneta" : "Carro"}
          </button>
        ))}
      </div>

      <p className="relative mt-6 flex items-end gap-2">
        <span className="num text-[3.6rem] font-bold leading-none text-white">${prices[v]}</span>
        <span className="pb-2 text-lg text-white/60">/ mes</span>
      </p>
      <p className="num relative mt-2 text-base text-white/65">${perWash} por lavada{saving > 0 && <span className="ml-2 rounded-full bg-gold/15 px-2.5 py-0.5 text-sm font-semibold text-gold">ahorras {saving}%</span>}</p>

      <ul className="relative mt-6 grid gap-3 border-t border-white/10 pt-5 text-[1.05rem] text-white/85">
        {perks.map((t) => <li key={t} className="flex gap-3"><Check />{t}</li>)}
      </ul>

      <div className="relative mt-7">
        <JoinFlow key={v} preset={v} prices={prices} washes={washes} mpPublicKey={mpPublicKey} soldOut={soldOut} label={soldOut ? "Lugares agotados" : "Suscribirme"} />
      </div>
      <p className="relative mt-4 text-center text-base text-white/60">
        ¿Ya eres socio? <a href="/socio" className="font-semibold text-gold underline decoration-gold/40 underline-offset-4">Entra a tu cuenta</a>
      </p>
    </div>
    </div>
  );
}
