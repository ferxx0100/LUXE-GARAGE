"use client";
import { useEffect, useState } from "react";
import GarageScene, { type Status } from "./GarageScene";
import { hour12, KIND, mxNow, type Kind } from "./fmt";

const POLL_MS = 5000;

type Spot = { date: string; time: string; inMinutes: number; label: string };
interface Garage {
  status: Status; updatedAt: string | null; now?: string;
  busyUntil: string | null; freeInMin: number | null;
  opens?: { label: string; inMinutes: number } | null;
  next?: { completo: Spot | null; exterior: Spot | null };
  at: number; // cuándo lo recibimos (para descontar minutos sin volver a preguntar)
}

// Tres apartados, cada uno con una sola idea: 1) cómo está ahorita, 2) qué significa, 3) aparta tu lugar.
const COPY: Record<Status, { word: string; color: string; dot: string }> = {
  LIBRE: { word: "LIBRE", color: "text-[#0b8a43]", dot: "bg-[#13b257]" },
  OCUPADO: { word: "OCUPADO", color: "text-[#c8231a]", dot: "bg-[#e5372c]" },
  CERRADO: { word: "CERRADO", color: "text-[#8a6d1a]", dot: "bg-gold" },
};

const LEGEND = [
  { dot: "bg-[#13b257]", t: "Verde", s: "Pasa sin cita" },
  { dot: "bg-[#e5372c]", t: "Rojo", s: "Estamos lavando" },
  { dot: "bg-[#8a6d1a]", t: "Cortina", s: "Cerrado" },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const KINDS = ["completo", "exterior"] as const;

export default function LiveGarage({ hours, mapsUrl, street }: { hours: string; mapsUrl: string; street: string }) {
  const [g, setG] = useState<Garage | null>(null);
  const [stale, setStale] = useState(false);
  const [now, setNow] = useState<ReturnType<typeof mxNow> | null>(null);
  const [flash, setFlash] = useState(false);

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
  const freeAt = status === "OCUPADO" && g?.busyUntil ? hour12(g.busyUntil) : null;
  const busyShort = freeAt ? `HASTA ${/^1[: ]/.test(freeAt) ? "LA" : "LAS"} ${freeAt.toUpperCase()}` : undefined;
  const pct = freeIn === null ? 0 : Math.round(100 * (1 - Math.min(freeIn, 30) / 30));

  // Qué significa lo que ves, en una frase según el estado.
  const meaning = status === "LIBRE" ? "No hay nadie en el lugar: pasa y te atendemos, sin cita. Si quieres asegurar tu hora, apártala aquí abajo."
    : status === "OCUPADO" ? `Estamos lavando un auto${freeAt ? ` y queda libre a las ${freeAt}` : ""}. Para no esperar, aparta tu lugar aquí abajo.`
    : status === "CERRADO" ? "La cortina está abajo. Puedes apartar desde ahora tu lugar para cuando abramos."
    : "";

  // Próximo lugar de cada servicio: "en 25 min" si es hoy, o el día.
  const spotText = (s: Spot) => {
    const isToday = now ? s.date === now.date : false;
    if (!isToday) return cap(s.label.replace(/\s\d{1,2}(:\d{2})?\s[ap]m$/, ""));
    const m = less(s.inMinutes) ?? 0;
    return m <= 0 ? "Ahora mismo" : m < 60 ? `En ${m} min` : `En ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
  };

  function take(spot: Spot, kind: Kind) {
    window.dispatchEvent(new CustomEvent("lg:prefill", { detail: { date: spot.date, time: spot.time, kind } }));
    document.getElementById("reservar")?.scrollIntoView({ behavior: "smooth" });
  }

  // Tocar el garage lleva directo a apartar.
  function toApartar() {
    document.getElementById("apartar")?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(true); setTimeout(() => setFlash(false), 1600);
  }

  return (
    <section aria-labelledby="estado" className="bg-[#f2f0eb] text-[#151413]">
      <div className="mx-auto max-w-5xl md:grid md:grid-cols-[minmax(0,440px)_1fr] md:items-start md:gap-12 md:px-6 md:py-12">
        <button type="button" onClick={toApartar} aria-label="Ir a apartar tu lugar"
          className="relative block w-full overflow-hidden text-left md:rounded-2xl md:border md:border-black/10 md:shadow-[0_18px_40px_rgba(40,30,10,.18)]">
          <GarageScene status={status} opensShort={opensShort} busyShort={busyShort} />
        </button>

        <div className="relative z-10 -mt-24 space-y-8 px-5 pb-16 md:mt-0 md:p-0" aria-live="polite">
          {/* 1 · Cómo está ahorita: todo centrado, la palabra a lo ancho de la tarjeta */}
          <div className="rounded-3xl bg-white px-5 pb-6 pt-4 text-center shadow-[0_12px_32px_-14px_rgba(40,30,10,.3)] ring-1 ring-black/5">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-black/55">
              <span className={`live-dot ${c?.dot ?? "bg-black/30"}`} />En vivo · información en tiempo real
            </p>
            <h1 id="estado" className={`font-display mt-3 text-[clamp(2.4rem,calc((100vw_-_80px)/5.9),3.4rem)] leading-none font-bold tracking-[.04em] ${c?.color ?? "text-black/25"}`}>
              {c?.word ?? "···"}
            </h1>

            {!status && <p className="mt-3 text-base text-black/60">{stale ? "Sin conexión. Reintentando…" : "Conectando con el garage…"}</p>}

            {status === "LIBRE" && <p className="mt-3 text-xl font-bold text-[#0b8a43]">Pasa y te atendemos</p>}

            {status === "OCUPADO" && (
              // Rojo = cuánto falta. Verde = hora en que queda libre. Texto, no botones.
              <div className="mt-4" role="group" aria-label="Tiempo para que se desocupe">
                <div className="grid grid-cols-2 divide-x divide-black/10">
                  <div>
                    <p className="text-sm text-black/55">{freeIn ? "Faltan" : "Ya casi"}</p>
                    <p className="text-2xl font-extrabold tabular-nums text-[#c8231a]">{freeIn ? `${freeIn} min` : "terminamos"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-black/55">Libre a las</p>
                    <p className="text-2xl font-extrabold tabular-nums text-[#0b8a43]">{freeAt ?? "—"}</p>
                  </div>
                </div>
                <div className="mx-auto mt-4 h-1.5 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del lavado">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#c8231a] to-[#0b8a43] transition-[width] duration-1000" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            {status === "CERRADO" && (
              <div className="mt-3">
                <p className="text-lg font-bold leading-snug">Abrimos {g?.opens ? g.opens.label : "pronto"}</p>
                {countdown && <p className="text-base font-semibold tabular-nums text-[#8a6d1a]">Faltan {countdown}</p>}
              </div>
            )}

            {stale && status && <p className="mt-3 text-sm text-black/50">Reconectando… mostramos el último estado.</p>}
          </div>

          {/* 2 · Qué significa */}
          <div>
            <h2 className="text-base font-bold">¿Qué significa?</h2>
            {meaning && <p className="mt-1 text-base leading-relaxed text-black/70">{meaning}</p>}
            <ul className="mt-3 grid grid-cols-3 gap-2" aria-label="Cómo leer el semáforo">
              {LEGEND.map((l) => (
                <li key={l.t} className="rounded-2xl bg-white px-2 py-2.5 text-center ring-1 ring-black/5">
                  <span className={`mx-auto block size-3 rounded-full ${l.dot}`} aria-hidden />
                  <span className="mt-1.5 block text-sm font-bold leading-tight">{l.t}</span>
                  <span className="block text-[13px] leading-tight text-black/60">{l.s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 3 · Aparta tu lugar */}
          <div id="apartar" className={`scroll-mt-20 rounded-3xl bg-[#0f0f10] p-5 text-white shadow-[0_18px_40px_-16px_rgba(20,15,5,.55)] transition-shadow duration-500 ${flash ? "ring-4 ring-gold" : "ring-0"}`}>
            <h2 className="text-base font-bold">Aparta tu lugar</h2>
            <p className="mt-1 text-sm text-white/60">Próximos lugares libres. Pagas en línea y la hora es tuya.</p>
            {!g?.next ? (
              <p className="mt-4 text-base text-white/70">Buscando el próximo lugar…</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {KINDS.map((k) => {
                  const s = g.next?.[k] ?? null;
                  return (
                    <li key={k} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[.06] px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white/70">{KIND[k].title}</p>
                        {s ? (
                          <>
                            <p className="text-2xl font-extrabold leading-tight tabular-nums text-gold">{hour12(s.time)}</p>
                            <p className="text-sm text-white/60">{spotText(s)}</p>
                          </>
                        ) : (
                          <p className="mt-0.5 text-base text-white/70">Sin lugares por ahora</p>
                        )}
                      </div>
                      {s && <button type="button" onClick={() => take(s, k)} className="btn-gold min-h-12 shrink-0 px-5 text-base">Apartar</button>}
                    </li>
                  );
                })}
              </ul>
            )}
            <a href="#reservar" className="mt-4 block text-center text-sm font-semibold text-white/75 underline decoration-white/30 underline-offset-4">¿Otra hora u otro día? Ver todas las horas</a>
          </div>

          {/* Dónde y cuándo */}
          <div className="text-center text-sm text-black/60">
            <p>Horario: {hours}</p>
            <p className="mt-1">{street} · <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-black/80 underline decoration-black/25 underline-offset-4">Cómo llegar</a></p>
          </div>
        </div>
      </div>
    </section>
  );
}
