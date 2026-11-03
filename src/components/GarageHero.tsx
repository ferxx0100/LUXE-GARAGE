"use client";
import { useEffect, useRef, useState } from "react";

type Status = "LIBRE" | "OCUPADO" | "CERRADO";
const POLL_MS = 5000;

const COPY: Record<Status, { label: string; sub: string; color: string }> = {
  LIBRE: { label: "DISPONIBLE", sub: "Llega ahora: el garage está libre", color: "#34d399" },
  OCUPADO: { label: "OCUPADO", sub: "Hay un auto en servicio ahora mismo", color: "#f87171" },
  CERRADO: { label: "CERRADO", sub: "Volvemos en nuestro horario", color: "#a1a1aa" },
};

function ago(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "actualizado hace unos segundos";
  const m = Math.round(s / 60);
  return m < 60 ? `actualizado hace ${m} min` : `actualizado hace ${Math.round(m / 60)} h`;
}

export default function GarageHero({ notice, hours }: { notice: string; hours: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [intro, setIntro] = useState(true); // el carro llega y se estaciona al entrar
  const [moving, setMoving] = useState(true);
  const [stale, setStale] = useState(false);
  const moveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Estado en vivo: sondeo con respaldo. (Fase 3: Supabase Realtime como canal principal.)
  useEffect(() => {
    let alive = true;
    async function tick() {
      if (document.hidden) return; // pestaña oculta: no gastar peticiones
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
    const vis = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", vis);
    return () => { alive = false; clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, []);

  // Fin de la intro: tras estacionarse, el carro se acomoda al estado real.
  useEffect(() => {
    if (status === null) return;
    const t = setTimeout(() => setIntro(false), 3400);
    return () => clearTimeout(t);
  }, [status !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const parked = intro ? true : status === "OCUPADO";
  const shown: Status = status ?? "LIBRE";
  const c = COPY[shown];

  // Rueda girando solo mientras el carro se mueve.
  useEffect(() => {
    setMoving(true);
    clearTimeout(moveTimer.current);
    moveTimer.current = setTimeout(() => setMoving(false), 2700);
    return () => clearTimeout(moveTimer.current);
  }, [parked]);

  const carX = parked ? 0 : 760;
  const working = parked && !intro && status === "OCUPADO";

  return (
    <section className="relative isolate overflow-hidden" aria-labelledby="hero-title">
      {notice && (
        <div className="border-b border-gold/30 bg-gold/10 px-4 py-2.5 text-center text-sm text-gold-hi" role="note">{notice}</div>
      )}
      <div className="mx-auto max-w-6xl px-4 pt-24 pb-6 text-center">
        <p className="rise-in text-xs tracking-[.5em] text-gold/80" style={{ animationDelay: ".2s" }}>
          AUTO DETAILING &amp; CAR CARE
        </p>
        <h1 id="hero-title" className="font-display mt-3 text-4xl font-bold tracking-[.14em] sm:text-7xl sm:tracking-[.18em]">
          {["LUXE", "GARAGE"].map((word, w) => (
            <span key={word} className="inline-block whitespace-nowrap">
              {w > 0 && " "}
              {word.split("").map((ch, i) => (
                <span key={i} className="rise-in text-gold-grad inline-block" style={{ animationDelay: `${0.35 + (w * 5 + i) * 0.07}s` }}>
                  {ch}
                </span>
              ))}
            </span>
          ))}
        </h1>
        <p className="rise-in mx-auto mt-4 max-w-xl text-white/70" style={{ animationDelay: "1.3s" }}>
          Vienes cuando está libre. Lo dejamos como nuevo.
        </p>
      </div>

      <div className={`mx-auto flex max-w-6xl justify-center overflow-hidden px-2 ${moving ? "moving" : ""}`} style={{ ["--car-x" as string]: `${carX}px` }}>
        <svg viewBox="0 0 1200 520" className="w-full min-w-[760px] shrink-0" role="img"
          aria-label={`Garage ${c.label.toLowerCase()}. ${c.sub}`}>
          <defs>
            <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9d6cd"/><stop offset="1" stopColor="#f2f0ea"/></linearGradient>
            <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b1b1d"/><stop offset="1" stopColor="#0a0a0b"/></linearGradient>
            <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b4a9c"/><stop offset=".5" stopColor="#1c2559"/><stop offset="1" stopColor="#0b0f2b"/></linearGradient>
            <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9fb4e8" stopOpacity=".55"/><stop offset="1" stopColor="#10162f"/></linearGradient>
            <radialGradient id="lamp"><stop offset="0" stopColor="#fff7d1"/><stop offset="1" stopColor="#fff7d1" stopOpacity="0"/></radialGradient>
            <pattern id="tiles" width="60" height="44" patternUnits="userSpaceOnUse">
              <rect width="60" height="44" fill="none" stroke="#b9b6ac" strokeWidth="1.2"/>
            </pattern>
            <clipPath id="room"><rect x="60" y="20" width="1080" height="400" rx="6"/></clipPath>
          </defs>

          {/* Pared de azulejo + piso */}
          <g clipPath="url(#room)">
            <rect x="60" y="20" width="1080" height="290" fill="url(#wall)"/>
            <rect x="60" y="20" width="1080" height="290" fill="url(#tiles)" opacity=".7"/>
            <rect x="60" y="300" width="1080" height="120" fill="url(#floor)"/>
            {/* rejillas de drenaje */}
            {[0,1,2,3].map((i) => (
              <g key={i} opacity=".9">
                <rect x={330 + i * 110} y="372" width="90" height="26" rx="2" fill="#050506" stroke="#3a3a3d"/>
                {[0,1,2,3,4,5].map((k) => <line key={k} x1={338 + i*110 + k*14} y1="374" x2={338 + i*110 + k*14} y2="396" stroke="#2a2a2d"/>)}
              </g>
            ))}
            {/* tubos fluorescentes */}
            <g className="fluor">
              {[240, 560, 880].map((x) => (
                <g key={x}>
                  <ellipse cx={x + 60} cy="40" rx="150" ry="50" fill="url(#lamp)" opacity=".55"/>
                  <rect x={x - 10} y="32" width="140" height="8" rx="4" fill="#fffbe6"/>
                </g>
              ))}
            </g>
            {/* logo en la pared, como el lugar real */}
            <g transform="translate(600 150)" opacity=".92">
              <path d="M-52-62 L0-78 L52-62 V8 Q52 46 0 74 Q-52 46 -52 8Z" fill="none" stroke="#a88a2d" strokeWidth="3"/>
              <g fill="#b8932f" transform="skewX(-10)">
                <path d="M-26-38h14l-8 52h26l-2 11h-38z"/>
                <path d="M6-38h34l-2 10H16l-5 30h14l1-8h-8l1-9h22l-5 30H4z"/>
              </g>
            </g>
            {/* brillo del piso según estado */}
            <ellipse className="floor-glow" cx="600" cy="392" rx="520" ry="26" fill={c.color} opacity={parked && shown === "OCUPADO" ? 0.12 : 0.22}/>
          </g>

          {/* Marco */}
          <rect x="60" y="20" width="1080" height="400" rx="6" fill="none" stroke="#2a2a2c" strokeWidth="6"/>

          {/* Letrero de estado */}
          <g transform="translate(600 452)">
            <rect x="-170" y="-26" width="340" height="52" rx="26" fill="#0c0c0d" stroke={c.color} strokeWidth="2"
              style={{ filter: `drop-shadow(0 0 14px ${c.color})`, transition: "all .6s" }}/>
            <circle className="pulse-dot" cx="-132" cy="0" r="7" fill={c.color}/>
            <text x="12" y="8" textAnchor="middle" fontSize="24" fontWeight="700" letterSpacing="6" fill={c.color}
              fontFamily="ui-sans-serif, system-ui, sans-serif">{c.label}</text>
          </g>

          {/* Carro (lado, sale hacia la derecha) */}
          <g clipPath="url(#room)"><g className="car">
            <ellipse cx="600" cy="392" rx="230" ry="14" fill="#000" opacity=".55"/>
            <g transform="translate(400 262)">
              <path d="M8 118 V92 Q10 76 34 70 L96 62 Q126 26 170 22 H262 Q300 26 322 60 L372 68 Q398 74 398 98 V118Z" fill="url(#body)"/>
              <path d="M104 62 Q130 34 172 32 H214 V62Z" fill="url(#glass)"/>
              <path d="M222 62 V32 H260 Q288 36 304 62Z" fill="url(#glass)"/>
              <path d="M30 78 Q200 66 380 80" stroke="#8fa2ef" strokeOpacity=".35" strokeWidth="2" fill="none"/>
              <rect x="372" y="84" width="22" height="9" rx="4" fill="#fff8d8"/>
              <circle className="car-lights" cx="396" cy="88" r="46" fill="url(#lamp)" opacity={parked && !moving ? 0.1 : 0.7} style={{ transition: "opacity .6s" }}/>
              <rect x="6" y="84" width="14" height="10" rx="3" fill="#ff3b3b"/>
              {[104, 304].map((cx) => (
                <g key={cx}>
                  <circle cx={cx} cy="118" r="30" fill="#0a0a0a"/>
                  <g className="wheel">
                    <circle cx={cx} cy="118" r="19" fill="#c9a43a"/>
                    <circle cx={cx} cy="118" r="14" fill="#171717"/>
                    {[0, 72, 144, 216, 288].map((a) => (
                      <rect key={a} x={cx - 2} y={118 - 17} width="4" height="15" fill="#d4af37" transform={`rotate(${a} ${cx} 118)`}/>
                    ))}
                  </g>
                </g>
              ))}
            </g>
            {/* espuma y agua mientras trabajan */}
            {working && (
              <g aria-hidden>
                {Array.from({ length: 14 }).map((_, i) => (
                  <circle key={i} className="bubble" cx={430 + ((i * 53) % 360)} cy={300 + ((i * 17) % 60)} r={4 + (i % 4) * 2}
                    fill="#fff" style={{ animationDelay: `${(i * 0.37) % 4}s` }}/>
                ))}
                <path className="spray" d="M270 250 Q360 270 470 330" stroke="#bfe3ff" strokeWidth="3" fill="none" strokeLinecap="round"/>
              </g>
            )}
          </g></g>
        </svg>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-16 text-center">
        <p className="text-lg text-white/85" aria-live="polite">{status === null ? "Conectando con el garage…" : c.sub}</p>
        {shown === "CERRADO" && <p className="mt-1 text-sm text-white/60">Horario: {hours}</p>}
        <p className="mt-1 text-xs text-white/40">
          {stale ? "Reconectando… mostrando el último estado conocido" : ago(updatedAt)}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="#reservar" className="rounded-full bg-gold px-7 py-3 font-semibold text-black transition hover:bg-gold-hi active:scale-95">Reservar</a>
          <a href="#suscripcion" className="rounded-full border border-gold/60 px-7 py-3 font-semibold text-gold transition hover:bg-gold/10 active:scale-95">Suscripción $555</a>
        </div>
      </div>
    </section>
  );
}
