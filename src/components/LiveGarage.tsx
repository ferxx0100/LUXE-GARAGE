"use client";
import { useEffect, useState } from "react";
import GarageScene, { type Status } from "./GarageScene";
import { clockPhrase, hour12, inText, KIND, mxNow, type Kind } from "./fmt";

const POLL_MS = 5000;

type Spot = { date: string; time: string; inMinutes: number; label: string };
interface Garage {
  status: Status; updatedAt: string | null; now?: string;
  busyUntil: string | null; freeInMin: number | null;
  opens?: { label: string; inMinutes: number } | null;
  next?: { completo: Spot | null; exterior: Spot | null };
  at: number; // cuándo lo recibimos (para descontar minutos sin volver a preguntar)
}

// Colores pensados para leerse sobre el azulejo claro.
const COPY: Record<Status, { word: string; color: string; dot: string }> = {
  LIBRE: { word: "LIBRE", color: "text-[#0b8a43]", dot: "bg-[#13b257]" },
  OCUPADO: { word: "OCUPADO", color: "text-[#c8231a]", dot: "bg-[#e5372c]" },
  CERRADO: { word: "CERRADO", color: "text-[#8a6d1a]", dot: "bg-gold" },
};

function ago(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "Actualizado hace segundos";
  const m = Math.round(s / 60);
  return m < 60 ? `Actualizado hace ${m} min` : `Actualizado hace ${Math.round(m / 60)} h`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
  const countdown = opensLeft === null ? "" : opensLeft < 60 ? `Faltan ${opensLeft} min` : opensLeft < 24 * 60 ? `Faltan ${Math.floor(opensLeft / 60)} h ${opensLeft % 60} min` : "";
  const opensShort = g?.opens ? `ABRE ${g.opens.label.replace(/^el /, "").replace(/^mañana \S+/, "mañana").replace(/ a las? /, " ")}`.toUpperCase() : undefined;

  // Ocupado: cuándo se desocupa (estimado) y barra de avance.
  const freeIn = status === "OCUPADO" ? less(g?.freeInMin) : null;
  const busyShort = status === "OCUPADO" && g?.busyUntil ? `LIBRE ${hour12(g.busyUntil).toUpperCase()}` : undefined;
  const pct = freeIn === null ? 0 : Math.round(100 * (1 - Math.min(freeIn, 30) / 30));

  // Próximo lugar reservable en línea.
  const spot = g?.next?.[kind] ?? null;
  const spotIn = spot ? less(spot.inMinutes) ?? 0 : 0;
  const isToday = spot && now ? spot.date === now.date : false;
  const spotSub = spot ? (isToday ? inText(spotIn) || cap(spot.label) : cap(spot.label)) : "";

  function take() {
    if (!spot) return;
    window.dispatchEvent(new CustomEvent("lg:prefill", { detail: { date: spot.date, time: spot.time, kind } }));
    document.getElementById("reservar")?.scrollIntoView({ behavior: "smooth" });
  }

  const clock = now ? clockPhrase(now.h, now.m) : null;

  return (
    <section aria-labelledby="estado" className="tile-hero text-[#151413]">
      <div className="mx-auto max-w-5xl md:grid md:grid-cols-[minmax(0,440px)_1fr] md:items-start md:gap-12 md:px-6 md:py-12">
        <div className="relative overflow-hidden shadow-[0_24px_60px_rgba(40,30,10,.25)] md:rounded-2xl md:border md:border-black/10">
          <GarageScene status={status} opensShort={opensShort} busyShort={busyShort} />
        </div>

        <div className="px-5 pb-14 pt-6 md:p-0" aria-live="polite">
          <p className="flex items-center gap-2 text-xs font-bold tracking-[.3em] text-black/60">
            <span className={`live-dot ${c?.dot ?? "bg-black/30"}`} />
            EN VIVO · ¿ESTÁ LIBRE?
          </p>
          <p className="mt-3 text-2xl font-semibold text-black/80" suppressHydrationWarning>
            {clock ? <>{clock.lead} <b className="tabular-nums text-black">{clock.time}</b> {clock.ap}</> : <span className="opacity-0">Son las 0:00 pm</span>}
          </p>
          <h1 id="estado" className={`font-display mt-1 text-[3.6rem] leading-none font-bold tracking-[.06em] sm:text-7xl ${c?.color ?? "text-black/25"}`}>
            {c?.word ?? "···"}
          </h1>

          {status === "LIBRE" && <p className="mt-4 text-2xl font-bold leading-snug">Ven ahora: no hay fila.</p>}
          {status === "OCUPADO" && (
            <div className="mt-4 rounded-2xl border border-[#c8231a]/25 bg-white/70 px-5 py-4">
              <p className="text-xl font-bold leading-snug">
                {g?.busyUntil ? <>Se desocupa aprox. a las <span className="tabular-nums">{hour12(g.busyUntil)}</span>{freeIn !== null && <> ({inText(freeIn) || "pronto"})</>}</> : "Estamos lavando un auto."}
              </p>
              {freeIn !== null && (
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del lavado">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#e5372c] to-[#13b257] transition-[width] duration-1000" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          )}
          {status === "CERRADO" && (
            <div className="mt-4 rounded-2xl border border-[#8a6d1a]/25 bg-white/70 px-5 py-4">
              {g?.opens ? <p className="text-2xl font-bold">Abrimos {g.opens.label}</p> : <p className="text-2xl font-bold">Ahora estamos cerrados.</p>}
              {countdown && <p className="mt-1 text-lg font-semibold tabular-nums text-[#8a6d1a]">{countdown}</p>}
              <p className="mt-2 text-base text-black/65">Horario: {hours}</p>
            </div>
          )}
          {!status && <p className="mt-4 text-xl text-black/70">{stale ? "Sin conexión. Reintentando…" : "Conectando con el garage…"}</p>}

          {/* PRÓXIMO LUGAR */}
          {g?.next && (
            <div className="mt-6 rounded-[26px] border border-black/10 bg-[#0f0f10] p-5 text-white shadow-[0_24px_50px_rgba(20,15,5,.35)]">
              <p className="text-xs font-bold tracking-[.3em] text-gold">PRÓXIMO LUGAR</p>
              <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-2xl bg-white/[.07] p-1.5" role="radiogroup" aria-label="Tipo de lavado">
                {(["completo", "exterior"] as const).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                    className={`min-h-14 rounded-xl px-2 py-2 text-center leading-tight transition ${kind === k ? "bg-gold text-ink" : "text-white/80"}`}>
                    <span className="block text-base font-bold">{KIND[k].title}</span>
                    <span className="block text-sm font-semibold opacity-75">{KIND[k].min} min</span>
                  </button>
                ))}
              </div>
              {spot ? (
                <>
                  <p className="font-display mt-4 text-[3rem] leading-none font-semibold tabular-nums text-gold-grad">{hour12(spot.time)}</p>
                  <p className="mt-2 text-xl font-semibold text-white/90">{spotSub}</p>
                  <button type="button" onClick={take} className="btn-gold mt-5 min-h-14 w-full text-xl">Apartar este lugar</button>
                </>
              ) : (
                <p className="mt-4 text-lg text-white/80">Por ahora no hay lugares en línea. Toca Ayuda y te atendemos.</p>
              )}
            </div>
          )}

          <p className="mt-4 text-sm text-black/55">{stale && status ? "Reconectando… mostramos el último estado conocido" : ago(g?.updatedAt ?? null)}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:flex">
            <a href="#reservar" className="btn-line-dark min-h-14">Ver horas</a>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-line-dark min-h-14">Cómo llegar</a>
          </div>
        </div>
      </div>
    </section>
  );
}
