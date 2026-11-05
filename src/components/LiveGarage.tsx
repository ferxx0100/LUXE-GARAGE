"use client";
import { useEffect, useState } from "react";
import GarageScene, { type Status } from "./GarageScene";
import { openReserve } from "./ReserveSheet";
import { DAY, mxNow, toMin, wd } from "./fmt";

const POLL_MS = 5000;

type Spot = { date: string; time: string; inMinutes: number; label: string };
interface Garage {
  status: Status; updatedAt: string | null;
  busyUntil: string | null; busySince?: string | null; freeInMin: number | null; freeUntil?: string | null;
  opens?: { label: string; inMinutes: number } | null;
  next?: { completo: Spot | null; exterior: Spot | null };
  at: number;
}

const WORD: Record<Status, { t: string; c: string }> = {
  LIBRE: { t: "LIBRE", c: "text-[#0b8a43]" },
  OCUPADO: { t: "OCUPADO", c: "text-[#c8231a]" },
  CERRADO: { t: "CERRADO", c: "text-[#8a6d1a]" },
};
const pad = (n: number) => String(n).padStart(2, "0");
/** "16:00" → "4:00" (sin am/pm: el contexto ya lo dice). */
const hm = (t: string) => { const m = toMin(t); return `${Math.floor(m / 60) % 12 || 12}:${pad(m % 60)}`; };

/**
 * Lo primero que se ve: ¿puedo ir ahorita? ROJO o VERDE, con rangos de hora claros ("Ocupado 4:00–4:30")
 * y solo dos botones: apartar el siguiente turno u otro día u hora. Sin explicar colores.
 */
export default function LiveGarage({ mapsUrl }: { mapsUrl: string }) {
  const [g, setG] = useState<Garage | null>(null);
  const [stale, setStale] = useState(false);
  const [now, setNow] = useState<ReturnType<typeof mxNow> | null>(null);

  useEffect(() => { const f = () => setNow(mxNow()); f(); const t = setInterval(f, 15000); return () => clearInterval(t); }, []);
  useEffect(() => {
    let alive = true;
    async function tick() {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/garage", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (alive) { setG({ ...d, at: Date.now() }); setStale(false); }
      } catch { if (alive) setStale(true); }
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { alive = false; clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, []);

  const status = g?.status ?? null;
  const elapsed = g ? Math.floor((Date.now() - g.at) / 60000) : 0;
  const freeIn = status === "OCUPADO" && g?.freeInMin != null ? Math.max(0, g.freeInMin - elapsed) : null;

  // Ocupado 4:00–4:30 · Libre hasta las 5:00 · Abre mañana 12 pm
  const busyRange = status === "OCUPADO" && g?.busyUntil ? `${g.busySince ? `${hm(g.busySince)}–` : "hasta "}${hm(g.busyUntil)}` : null;
  const freeUntil = status === "LIBRE" && g?.freeUntil ? hm(g.freeUntil) : null;
  const opens = status === "CERRADO" && g?.opens ? g.opens.label : null;
  const opensShort = opens ? `ABRE ${opens.replace(/^el /, "").replace(/^mañana \S+/, "mañana").replace(/ a las? /, " ")}`.toUpperCase() : undefined;

  const spot = g?.next?.completo ?? null;
  // Libre: el siguiente turno empieza ~5 min después de ahora → "Apartar ahora · 4:45–5:15".
  const soon = status === "LIBRE" && !!spot && !!now && spot.date === now.date && spot.inMinutes - elapsed <= 10;
  const spotDay = spot && now ? (spot.date === now.date ? "" : wd(spot.date) === (wd(now.date) + 1) % 7 && spot.inMinutes < 2 * 1440 ? "mañana " : `${DAY[wd(spot.date)].toLowerCase()} `) : "";

  return (
    <section aria-labelledby="estado" className="bg-[#f2f0eb] text-[#151413]">
      <div className="mx-auto max-w-[30rem] md:py-8">
        {/* La escena se recorta abajo (piso) para que el estado y los botones se vean sin bajar en el celular. */}
        <div className="relative aspect-[400/470] overflow-hidden md:rounded-3xl md:shadow-[0_18px_40px_rgba(40,30,10,.18)]">
          <div className="absolute inset-x-0 top-0">
            <GarageScene status={status} busyShort={busyRange ?? undefined} opensShort={opensShort} freeShort={freeUntil ?? undefined} />
          </div>
        </div>

        <div className="relative z-10 -mt-12 px-4 pb-10" aria-live="polite">
          <div className="rounded-3xl bg-white px-5 pb-4 pt-3 text-center shadow-[0_12px_32px_-14px_rgba(40,30,10,.35)] ring-1 ring-black/5">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-black/50">
              <span className={`live-dot ${status === "LIBRE" ? "bg-[#13b257]" : status === "OCUPADO" ? "bg-[#e5372c]" : "bg-gold"}`} />
              {stale ? "Reconectando…" : "En vivo"}
            </p>
            <h1 id="estado" className={`font-display mt-1 text-[clamp(2.6rem,13vw,3.6rem)] font-bold leading-none tracking-[.04em] ${status ? WORD[status].c : "text-black/20"}`}>
              {status ? WORD[status].t : "···"}
            </h1>
            <p className="num mt-2 min-h-8 text-2xl font-bold">
              {status === "OCUPADO" && <>{busyRange ?? ""}{freeIn !== null && freeIn > 0 && <span className="ml-2 text-base font-medium text-black/55">faltan {freeIn} min</span>}</>}
              {status === "LIBRE" && (freeUntil ? <>Pasa · hasta {/^1:/.test(freeUntil) ? "la" : "las"} {freeUntil}</> : "Pasa")}
              {status === "CERRADO" && (opensShort ? `Abre ${opensShort.slice(5).toLowerCase()}` : "")}
            </p>

            <div className="mt-4 grid gap-2.5">
              <button type="button" disabled={!spot} onClick={() => spot && openReserve({ date: spot.date, time: spot.time })}
                className="btn-gold min-h-[4.5rem] w-full flex-col text-lg leading-tight disabled:opacity-50">
                {/* Un solo botón: aparta el siguiente horario libre. Socio (celular + NIP) o paga un lavado. */}
                {spot ? (
                  <>
                    <span className="whitespace-nowrap">Apartar siguiente horario</span>
                    <span className="num whitespace-nowrap text-xl font-bold">{spotDay}{hm(spot.time)}</span>
                  </>
                ) : "Buscando turno…"}
              </button>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-black/55">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-black/75 underline decoration-black/25 underline-offset-4">Cómo llegar</a>
            <span className="mx-2">·</span>
            <a href="/socio" className="font-semibold text-black/75 underline decoration-black/25 underline-offset-4">Mi cuenta de socio</a>
          </p>
        </div>
      </div>
    </section>
  );
}
