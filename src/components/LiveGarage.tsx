"use client";
import { useEffect, useState } from "react";
import GarageScene, { type Status } from "./GarageScene";
import { hour12, inText, KIND, mxNow, type Kind } from "./fmt";

const POLL_MS = 5000;

type Spot = { date: string; time: string; inMinutes: number; label: string };
interface Garage {
  status: Status; updatedAt: string | null; now?: string;
  busyUntil: string | null; freeInMin: number | null;
  opens?: { label: string; inMinutes: number } | null;
  next?: { completo: Spot | null; exterior: Spot | null };
  at: number; // cuándo lo recibimos (para descontar minutos sin volver a preguntar)
}

// Una sola tipografía de título (la palabra del estado); todo lo demás en Manrope y en pocos tamaños.
const COPY: Record<Status, { word: string; color: string; dot: string; line: string }> = {
  LIBRE: { word: "LIBRE", color: "text-[#0b8a43]", dot: "bg-[#13b257]", line: "No hay fila. Puedes venir ahora mismo." },
  OCUPADO: { word: "OCUPADO", color: "text-[#c8231a]", dot: "bg-[#e5372c]", line: "Estamos lavando un auto." },
  CERRADO: { word: "CERRADO", color: "text-[#8a6d1a]", dot: "bg-gold", line: "Por ahora la cortina está abajo." },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Pequeña leyenda para entender la escena de un vistazo.
const LEGEND = [
  { dot: "bg-[#13b257]", t: "Verde", s: "Pasa sin cita" },
  { dot: "bg-[#e5372c]", t: "Rojo", s: "Estamos lavando" },
  { dot: "bg-[#8a6d1a]", t: "Cortina", s: "Cerrado" },
];

export default function LiveGarage({ hours, mapsUrl }: { hours: string; mapsUrl: string }) {
  const [g, setG] = useState<Garage | null>(null);
  const [stale, setStale] = useState(false);
  const [now, setNow] = useState<ReturnType<typeof mxNow> | null>(null);
  const [kind, setKind] = useState<Kind>("completo");

  // Reloj en vivo (hora de Zamora), avanza solo.
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
  const c = status ? COPY[status] : null;
  const elapsed = g ? Math.floor((Date.now() - g.at) / 60000) : 0;
  const less = (m: number | null | undefined) => (m == null ? null : Math.max(0, m - elapsed));

  // Cerrado: cuenta regresiva y letrero LED de la cortina.
  const opensLeft = less(g?.opens?.inMinutes);
  const countdown = opensLeft === null ? "" : opensLeft < 60 ? `${opensLeft} min` : opensLeft < 24 * 60 ? `${Math.floor(opensLeft / 60)} h${opensLeft % 60 ? ` ${opensLeft % 60} min` : ""}` : "";
  const opensShort = g?.opens ? `ABRE ${g.opens.label.replace(/^el /, "").replace(/^mañana \S+/, "mañana").replace(/ a las? /, " ")}`.toUpperCase() : undefined;

  // Ocupado: cuándo se desocupa (estimado) y barra de avance.
  const freeIn = status === "OCUPADO" ? less(g?.freeInMin) : null;
  const busyShort = status === "OCUPADO" && g?.busyUntil ? `LIBRE ${hour12(g.busyUntil).toUpperCase()}` : undefined;
  const pct = freeIn === null ? 0 : Math.round(100 * (1 - Math.min(freeIn, 30) / 30));

  // Próximo lugar reservable en línea.
  const spot = g?.next?.[kind] ?? null;
  const spotIn = spot ? less(spot.inMinutes) ?? 0 : 0;
  const isToday = spot && now ? spot.date === now.date : false;
  const spotSub = spot ? (isToday ? cap(inText(spotIn) || "hoy") : cap(spot.label.replace(/\s\d{1,2}(:\d{2})?\s[ap]m$/, ""))) : "";

  function take() {
    if (!spot) return;
    window.dispatchEvent(new CustomEvent("lg:prefill", { detail: { date: spot.date, time: spot.time, kind } }));
    document.getElementById("reservar")?.scrollIntoView({ behavior: "smooth" });
  }

  const clock = now ? `${now.h % 12 || 12}:${String(now.m).padStart(2, "0")} ${now.h < 12 ? "am" : "pm"}` : "";

  return (
    <section aria-labelledby="estado" className="bg-[#f2f0eb] text-[#151413]">
      <div className="mx-auto max-w-5xl md:grid md:grid-cols-[minmax(0,440px)_1fr] md:items-start md:gap-12 md:px-6 md:py-12">
        <div className="relative overflow-hidden md:rounded-2xl md:border md:border-black/10 md:shadow-[0_18px_40px_rgba(40,30,10,.18)]">
          <GarageScene status={status} opensShort={opensShort} busyShort={busyShort} />
        </div>

        <div className="relative z-10 -mt-24 space-y-5 px-5 pb-16 md:mt-0 md:p-0" aria-live="polite">
          {/* Estado actual */}
          <div className="rounded-3xl bg-white p-5 shadow-[0_12px_32px_-14px_rgba(40,30,10,.3)] ring-1 ring-black/5">
            <div className="flex items-center justify-between text-sm font-semibold text-black/55">
              <span className="flex items-center gap-2"><span className={`live-dot ${c?.dot ?? "bg-black/30"}`} />En vivo</span>
              <span className="tabular-nums" suppressHydrationWarning>{clock}</span>
            </div>
            <h1 id="estado" className={`font-display mt-2 text-[2.6rem] leading-none font-bold tracking-[.05em] ${c?.color ?? "text-black/25"}`}>
              {c?.word ?? "···"}
            </h1>
            <p className="mt-2 text-lg text-black/75">{c ? c.line : stale ? "Sin conexión. Reintentando…" : "Conectando con el garage…"}</p>

            {status === "LIBRE" && (
              <p className="mt-4 rounded-2xl bg-[#0b8a43] px-4 py-3 text-center text-lg font-bold text-white">Pasa directo, sin cita</p>
            )}

            {status === "OCUPADO" && (
              // Rojo = cuánto falta. Verde = hora en que queda libre.
              <div className="mt-4" role="group" aria-label="Tiempo para que se desocupe">
                <div className="grid grid-cols-2 gap-2 text-white">
                  <div className="rounded-2xl bg-[#c8231a] px-4 py-3">
                    <p className="text-sm font-semibold opacity-90">{freeIn ? "Faltan" : "Ya casi"}</p>
                    <p className="text-2xl font-extrabold tabular-nums">{freeIn ? `${freeIn} min` : "terminamos"}</p>
                  </div>
                  <div className="rounded-2xl bg-[#0b8a43] px-4 py-3">
                    <p className="text-sm font-semibold opacity-90">Libre a las</p>
                    <p className="text-2xl font-extrabold tabular-nums">{g?.busyUntil ? hour12(g.busyUntil) : "—"}</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del lavado">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#c8231a] to-[#0b8a43] transition-[width] duration-1000" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            {status === "CERRADO" && (
              <div className="mt-4 rounded-2xl bg-[#f2f0eb] px-4 py-3">
                <p className="text-sm font-semibold text-black/60">Abrimos</p>
                <p className="text-xl font-extrabold leading-snug">{g?.opens ? cap(g.opens.label) : "Pronto"}</p>
                {countdown && <p className="text-base font-semibold tabular-nums text-[#8a6d1a]">Faltan {countdown}</p>}
              </div>
            )}

            {stale && status && <p className="mt-3 text-sm text-black/50">Reconectando… mostramos el último estado.</p>}
            <p className="mt-4 border-t border-black/5 pt-3 text-sm text-black/55">Horario: {hours}</p>
          </div>

          {/* Qué significa la escena */}
          <div>
            <p className="text-center text-base text-black/70">Arriba ves nuestro garage <b className="text-black/85">en vivo</b>. El semáforo te dice si puedes pasar:</p>
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {LEGEND.map((l) => (
                <li key={l.t} className="rounded-2xl bg-white px-2 py-2.5 text-center shadow-[0_1px_0_rgba(0,0,0,.04)] ring-1 ring-black/5">
                  <span className={`mx-auto block size-3 rounded-full ${l.dot}`} aria-hidden />
                  <span className="mt-1.5 block text-sm font-bold leading-tight">{l.t}</span>
                  <span className="block text-[13px] leading-tight text-black/60">{l.s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Próximo lugar para apartar */}
          {g?.next && (
            <div className="rounded-3xl bg-[#0f0f10] p-5 text-white shadow-[0_18px_40px_-16px_rgba(20,15,5,.55)]">
              <p className="text-base font-bold">¿Prefieres asegurar tu hora?</p>
              <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-white/[.07] p-1" role="radiogroup" aria-label="Tipo de lavado">
                {(["completo", "exterior"] as const).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                    className={`min-h-12 rounded-xl px-2 text-center text-sm font-bold leading-tight transition ${kind === k ? "bg-gold text-ink" : "text-white/75"}`}>
                    {KIND[k].title}<span className="block text-xs font-semibold opacity-75">{KIND[k].min} min</span>
                  </button>
                ))}
              </div>
              {spot ? (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white/60">Próximo lugar</p>
                    <p className="text-[1.75rem] font-extrabold leading-tight tabular-nums text-gold">{hour12(spot.time)}</p>
                    <p className="text-sm text-white/75">{spotSub}</p>
                  </div>
                  <button type="button" onClick={take} className="btn-gold min-h-12 shrink-0 px-6 text-base">Apartar</button>
                </div>
              ) : (
                <p className="mt-4 text-base text-white/75">Por ahora no hay lugares en línea. Toca Ayuda y te atendemos.</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-6 text-base font-semibold text-black/70">
            <a href="#reservar" className="underline decoration-black/25 underline-offset-4">Ver todas las horas</a>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-black/25 underline-offset-4">Cómo llegar</a>
          </div>
        </div>
      </div>
    </section>
  );
}
