"use client";
import { useEffect, useState } from "react";
import GarageScene, { type Status } from "./GarageScene";

const POLL_MS = 5000;

// Las palabras: cortas, se leen de lejos y son las que ya conoce cualquier conductor.
const COPY: Record<Status, { word: string; line: string; color: string }> = {
  LIBRE: { word: "LIBRE", line: "Pasa ahora. No hay nadie en la fosa.", color: "text-go" },
  OCUPADO: { word: "OCUPADO", line: "Estamos lavando un auto. Reserva tu hora y no esperes.", color: "text-stop" },
  CERRADO: { word: "CERRADO", line: "Ahora estamos cerrados. Reserva tu lugar en línea.", color: "text-zinc-300" },
};

function ago(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "Actualizado hace segundos";
  const m = Math.round(s / 60);
  return m < 60 ? `Actualizado hace ${m} min` : `Actualizado hace ${Math.round(m / 60)} h`;
}

export default function LiveGarage({ hours, mapsUrl }: { hours: string; mapsUrl: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    async function tick() {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/garage", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!alive) return;
        setStatus(d.status); setUpdatedAt(d.updatedAt); setStale(false);
      } catch { if (alive) setStale(true); }
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { alive = false; clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, []);

  const c = status ? COPY[status] : null;
  const book = <a href="#reservar" className="btn-gold">Reservar hora</a>;
  const go = <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-line">Cómo llegar</a>;

  return (
    <section aria-labelledby="estado" className="mx-auto max-w-5xl md:grid md:grid-cols-[minmax(0,440px)_1fr] md:items-center md:gap-12 md:px-6 md:py-10">
      <div className="relative -mx-0 overflow-hidden md:rounded-2xl md:border md:border-white/10">
        <GarageScene status={status} />
      </div>

      <div className="px-5 pb-12 pt-2 md:p-0" aria-live="polite">
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[.35em] text-white/55">
          <span className={`live-dot ${status === "LIBRE" ? "bg-go" : status === "OCUPADO" ? "bg-stop" : "bg-zinc-500"}`} />
          EN VIVO · ¿ESTÁ LIBRE?
        </p>
        <h1 id="estado" className={`font-display mt-3 text-[3.4rem] leading-none font-semibold tracking-[.08em] sm:text-7xl ${c?.color ?? "text-white/40"}`}>
          {c?.word ?? "···"}
        </h1>
        <p className="mt-4 text-lg leading-snug text-white/85">{c?.line ?? "Conectando con el garage…"}</p>
        {status === "CERRADO" && <p className="mt-1 text-sm text-white/55">Horario: {hours}</p>}
        <p className="mt-2 text-xs text-white/40">{stale ? "Reconectando… mostramos el último estado conocido" : ago(updatedAt)}</p>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:flex">
          {status === "LIBRE" ? <>{go}{book}</> : <>{book}{go}</>}
        </div>
      </div>
    </section>
  );
}
