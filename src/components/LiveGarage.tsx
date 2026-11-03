"use client";
import { useEffect, useState } from "react";
import GarageScene, { type Status } from "./GarageScene";
import { hour12, mxNow } from "./fmt";

const POLL_MS = 5000;

type Spot = { date: string; time: string; inMinutes: number; label: string };
interface Garage {
  status: Status; updatedAt: string | null; now?: string;
  busyUntil: string | null; freeInMin: number | null;
  opens?: { label: string; inMinutes: number } | null;
  next?: { completo: Spot | null; exterior: Spot | null };
  at: number; // cuándo lo recibimos
}

// Marco de la escena: el color del estado se ve antes de leer nada.
const FRAME: Record<Status, string> = {
  LIBRE: "ring-[#2ee87f] shadow-[0_0_0_6px_rgba(46,232,127,.18),0_30px_70px_rgba(46,232,127,.28)]",
  OCUPADO: "ring-[#ff3b30] shadow-[0_0_0_6px_rgba(255,59,48,.18),0_30px_70px_rgba(255,59,48,.28)]",
  CERRADO: "ring-[#ffb547]/80 shadow-[0_0_0_6px_rgba(255,181,71,.14),0_30px_70px_rgba(20,25,60,.35)]",
};
const DOT: Record<Status, string> = { LIBRE: "bg-[#2ee87f]", OCUPADO: "bg-[#ff3b30]", CERRADO: "bg-[#ffb547]" };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "4:30 PM" → "LIBRE A LAS 4:30 PM" / "1 PM" → "LIBRE A LA 1 PM" */
const freeAt = (t: string) => `Libre ${Number(t.slice(0, 2)) % 12 === 1 ? "a la" : "a las"} ${hour12(t)}`;

export default function LiveGarage({ mapsUrl }: { mapsUrl: string }) {
  const [g, setG] = useState<Garage | null>(null);
  const [stale, setStale] = useState(false);
  const [now, setNow] = useState<ReturnType<typeof mxNow> | null>(null);

  // Reloj en vivo (hora de Zamora): prueba de que no es un dibujo.
  useEffect(() => { const f = () => setNow(mxNow()); f(); const t = setInterval(f, 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    let alive = true;
    async function tick() {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/garage", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!alive) return;
        setG({ ...d, at: Date.now() }); setStale(false);
      } catch { if (alive) setStale(true); }
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { alive = false; clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, []);

  const status = g?.status ?? null;

  // Segunda línea del neón: lo único que hay que explicar.
  const opens = g?.opens ? `Abre ${g.opens.label.replace(/^el /, "").replace(/^mañana \S+/, "mañana").replace(/ a las? /, " ")}` : "";
  const sub = status === "LIBRE" ? "Pasa, no hay fila"
    : status === "OCUPADO" ? (g?.busyUntil ? freeAt(g.busyUntil) : "Lavando un auto")
    : status === "CERRADO" ? opens
    : stale ? "Sin conexión" : "Conectando";

  // Próximo lugar reservable en línea (lavado completo; en la reserva se puede cambiar a solo exterior).
  const spot = g?.next?.completo ?? g?.next?.exterior ?? null;
  const spotKind = g?.next?.completo ? "completo" : "exterior";

  function reserve() {
    if (spot) window.dispatchEvent(new CustomEvent("lg:prefill", { detail: { date: spot.date, time: spot.time, kind: spotKind } }));
    document.getElementById("reservar")?.scrollIntoView({ behavior: "smooth" });
  }

  const clock = now ? hour12(`${String(now.h).padStart(2, "0")}:${String(now.m).padStart(2, "0")}`) : "";
  const spotText = spot ? (now && spot.date === now.date ? `Hoy ${hour12(spot.time)}` : cap(spot.label)) : "";

  return (
    <section aria-labelledby="estado" className="tile-hero text-[#151413]">
      <h1 id="estado" className="sr-only">{status ? `Garage en vivo: ${status.toLowerCase()}. ${sub}` : "Garage en vivo"}</h1>
      <div className="mx-auto max-w-[30rem] md:px-4 md:py-10">
        <div className={`relative overflow-hidden ring-4 transition-[box-shadow] duration-700 md:rounded-[30px] ${status ? FRAME[status] : "ring-black/10"}`} aria-live="polite">
          <GarageScene status={status} sub={sub} />

          {/* EN VIVO + hora: se entiende que es el garage ahorita, no un dibujo */}
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/75 py-1.5 pl-3 pr-3.5 text-[13px] font-semibold text-white backdrop-blur" suppressHydrationWarning>
            <span className={`live-dot ${status && !stale ? DOT[status] : "bg-white/40"}`} />
            <span className="tracking-[.12em]">{stale ? "RECONECTANDO" : "EN VIVO"}</span>
            {clock && <span className="num text-white/80">{clock}</span>}
          </div>

          {/* Botones sobre el piso del pasillo: siempre a la vista */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/25 to-transparent px-4 pb-4 pt-14">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <button type="button" onClick={reserve} className="btn-gold min-h-16 flex-col px-4! leading-tight shadow-[0_12px_30px_rgba(0,0,0,.35)]">
                <span className="text-lg">Reservar</span>
                {spotText && <span className="num text-[13px] font-medium opacity-80">{spotText}</span>}
              </button>
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" aria-label="Cómo llegar (abre Mapas)"
                className="flex min-h-16 min-w-16 flex-col items-center justify-center gap-0.5 rounded-full bg-white px-5 text-[#141414] shadow-[0_12px_30px_rgba(0,0,0,.35)] active:scale-[.97]">
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" /><circle cx="12" cy="9" r="2.6" />
                </svg>
                <span className="text-xs font-semibold">Llegar</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
