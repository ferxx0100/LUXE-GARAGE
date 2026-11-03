"use client";
import { useEffect, useRef } from "react";

export type Status = "LIBRE" | "OCUPADO" | "CERRADO";

/* ───────── Perspectiva de un punto: cámara parada afuera, mirando hacia la fosa ─────────
   Medidas reales aproximadas en metros: bahía 3.2 m de ancho, 2.6 m de alto, 6 m de fondo. */
const F = 420, ZC = 5, CAM = 1.4, HZ = 250, CX = 200;
const W = 1.6, H = 2.6, D = 6;
const sc = (z: number) => F / (z + ZC);
const X = (x: number, z: number) => CX + x * sc(z);
const Y = (y: number, z: number) => HZ + (CAM - y) * sc(z);
type V = [number, number, number];
const p = ([x, y, z]: V) => `${X(x, z).toFixed(1)},${Y(y, z).toFixed(1)}`;
const poly = (...v: V[]) => v.map(p).join(" ");
const seg = (a: V, b: V) => `M${p(a)}L${p(b)}`;
const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

// Azulejo (como el del lugar): retícula cuadrada con junta gris.
const TILES_BACK = [
  ...range(-W, W, 12).map((x) => seg([x, 0, D], [x, H, D])),
  ...range(0, H, 10).map((y) => seg([-W, y, D], [W, y, D])),
].join("");
const tilesSide = (s: number) =>
  [...range(0, D, 20).map((z) => seg([s * W, 0, z], [s * W, H, z])), ...range(0, H, 10).map((y) => seg([s * W, y, 0], [s * W, y, D]))].join("");
const TILES_L = tilesSide(-1), TILES_R = tilesSide(1);

// La fosa: rejillas de acero negro en cuadrícula (2 columnas × 5 filas) con marco grueso.
const FX = 0.95, FZ0 = 0.45, FZ1 = 5.65, ROWS = 5;
const PANELS: { poly: string; bars: string }[] = [];
for (const [xa, xb] of [[-FX + 0.05, -0.035], [0.035, FX - 0.05]]) {
  for (let r = 0; r < ROWS; r++) {
    const z0 = FZ0 + ((FZ1 - FZ0) / ROWS) * r + 0.05, z1 = FZ0 + ((FZ1 - FZ0) / ROWS) * (r + 1) - 0.05;
    const n = Math.round((xb - xa) / 0.045);
    const bars = [
      ...range(xa, xb, n).map((x) => seg([x, 0, z0], [x, 0, z1])),
      ...range(z0, z1, 4).map((z) => seg([xa, 0, z], [xb, 0, z])),
    ].join("");
    PANELS.push({ poly: poly([xa, 0, z0], [xb, 0, z0], [xb, 0, z1], [xa, 0, z1]), bars });
  }
}

// Flechas de luz en el piso de la entrada (afuera), apuntando hacia la fosa.
const CHEVRONS = [-2.7, -2.0, -1.3, -0.6].map((z) =>
  poly([-0.5, 0, z], [0, 0, z + 0.36], [0.5, 0, z], [0.5, 0, z + 0.15], [0, 0, z + 0.51], [-0.5, 0, z + 0.15]),
);

const ENTRANCE = { x0: X(-W, 0), x1: X(W, 0), y0: Y(H, 0), y1: Y(0, 0) };

/* ───────── Semáforo LED de matriz de puntos (7×7) ───────── */
const GRID = range(-3, 3, 6);
const X_MARK = (i: number, j: number) => i === j || i === -j;
const ARROW = (i: number, j: number) => (j <= 0 ? Math.abs(i) <= j + 3 : Math.abs(i) <= 1);
const SIG = { LIBRE: "#2ee87f", OCUPADO: "#ff3b30" } as const;

function Lamp({ cx, cy, on, color, shape, dim }: { cx: number; cy: number; on: boolean; color: string; shape: (i: number, j: number) => boolean; dim: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="17" fill="#020202" stroke="#1d1d1f" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r="15" fill={color} opacity={on ? 0.22 : 0} filter="url(#lg-glow-lg)" className="lg-fade" />
      <g filter={on ? "url(#lg-glow-sm)" : undefined}>
        {GRID.flatMap((j) =>
          GRID.map((i) => {
            const lit = on && shape(i, j);
            return <circle key={`${i}${j}`} cx={cx + i * 3.6} cy={cy + j * 3.6} r="1.25" fill={lit ? color : dim} className="lg-fade" />;
          }),
        )}
      </g>
      {/* visera */}
      <path d={`M${cx - 18} ${cy - 9} Q${cx} ${cy - 27} ${cx + 18} ${cy - 9} L${cx + 15} ${cy - 13} Q${cx} ${cy - 23} ${cx - 15} ${cy - 13}Z`} fill="#000" />
      <ellipse cx={cx - 6} cy={cy - 7} rx="5" ry="2.5" fill="#fff" opacity=".08" transform={`rotate(-30 ${cx - 6} ${cy - 7})`} />
    </g>
  );
}

export function Semaforo({ status, x = 0, y = 0 }: { status: Status | null; x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-4" y="40" width="10" height="6" fill="#111" />
      <rect x="0" y="0" width="44" height="124" rx="9" fill="#0a0a0b" stroke="#2c2c2f" strokeWidth="1.5" />
      <rect x="3" y="3" width="38" height="118" rx="7" fill="none" stroke="#000" strokeWidth="1" />
      <Lamp cx={22} cy={34} on={status === "OCUPADO"} color={SIG.OCUPADO} shape={X_MARK} dim="#2a0a09" />
      <Lamp cx={22} cy={90} on={status === "LIBRE"} color={SIG.LIBRE} shape={ARROW} dim="#08240f" />
    </g>
  );
}

/* ───────── Honda Accord (11.ª gen.) gris, vista trasera. Unidades: cm, origen al piso al centro ───────── */
function Accord({ brakeRef, revRef, foam }: { brakeRef: React.Ref<SVGGElement>; revRef: React.Ref<SVGGElement>; foam: boolean }) {
  const lampL = "M-93 -83 L-58 -85 L-56 -75 L-91 -71 Z";
  const lampR = "M93 -83 L58 -85 L56 -75 L91 -71 Z";
  return (
    <g>
      <ellipse cx="0" cy="-1" rx="112" ry="12" fill="#000" opacity=".7" filter="url(#lg-blur)" />
      {/* llantas */}
      <rect x="-93" y="-34" width="27" height="34" rx="5" fill="#0a0a0a" />
      <rect x="66" y="-34" width="27" height="34" rx="5" fill="#0a0a0a" />
      {/* espejos */}
      <path d="M-92 -106 Q-106 -108 -108 -99 Q-104 -94 -92 -97Z" fill="url(#lg-paint)" />
      <path d="M92 -106 Q106 -108 108 -99 Q104 -94 92 -97Z" fill="url(#lg-paint)" />
      {/* cabina (pilares C) y medallón */}
      <path d="M-78 -90 L-61 -133 Q-52 -145 -30 -146 L30 -146 Q52 -145 61 -133 L78 -90Z" fill="url(#lg-paint)" />
      <path d="M-66 -93 L-51 -131 Q-45 -139 -28 -140 L28 -140 Q45 -139 51 -131 L66 -93 Q0 -88 -66 -93Z" fill="url(#lg-glass)" />
      <path d="M-40 -136 L-14 -136 L-38 -96 L-56 -96Z" fill="#fff" opacity=".07" />
      <path d="M8 -136 L22 -136 L4 -95 L-8 -95Z" fill="#fff" opacity=".05" />
      {/* carrocería */}
      <path d="M-91 -24 L-94 -60 Q-94 -84 -84 -91 Q0 -96 84 -91 Q94 -84 94 -60 L91 -24Z" fill="url(#lg-paint)" />
      <path d="M-84 -91 Q0 -96 84 -91 L82 -87 Q0 -91 -82 -87Z" fill="#e7eaed" opacity=".55" />
      <path d="M-90 -64 Q0 -67 90 -64" stroke="#fff" strokeOpacity=".18" strokeWidth="1.2" fill="none" />
      {/* barra LED de lado a lado (sello del Accord) */}
      <path d={lampL} fill="#3b0d0c" />
      <path d={lampR} fill="#3b0d0c" />
      <rect x="-58" y="-81" width="116" height="2.6" rx="1.3" fill="#4a0f0d" />
      <g className="lg-tail">
        <path d={lampL} fill="#e0261d" opacity=".75" />
        <path d={lampR} fill="#e0261d" opacity=".75" />
        <rect x="-58" y="-81" width="116" height="2.6" rx="1.3" fill="#ff3a2e" opacity=".85" />
      </g>
      <g ref={brakeRef} opacity="0" filter="url(#lg-glow-sm)">
        <path d={lampL} fill="#ff4a3d" />
        <path d={lampR} fill="#ff4a3d" />
        <rect x="-58" y="-81.5" width="116" height="3.6" rx="1.8" fill="#ff6a5c" />
        <rect x="-14" y="-150" width="28" height="3" rx="1.5" fill="#ff3b30" />
      </g>
      <g ref={revRef} opacity="0" filter="url(#lg-glow-sm)">
        <rect x="-86" y="-79" width="13" height="5" rx="2" fill="#fff" />
        <rect x="73" y="-79" width="13" height="5" rx="2" fill="#fff" />
      </g>
      {/* placa y fascia */}
      <rect x="-31" y="-57" width="62" height="22" rx="3" fill="#2a2c2f" />
      <rect x="-27" y="-54" width="54" height="16" rx="2" fill="#eceae4" />
      <text x="0" y="-42" textAnchor="middle" fontSize="10" fontWeight="600" letterSpacing="2" fill="#1d1d1f" style={{ fontFamily: "var(--font-display)" }}>LUXE</text>
      <path d="M-90 -31 L90 -31 L85 -22 L-85 -22Z" fill="#0f1011" />
      <path d="M-60 -27 L60 -27" stroke="#2a2c2f" strokeWidth="1" />
      {/* espuma cuando lo están lavando */}
      <g className={`lg-foam ${foam ? "on" : ""}`}>
        <path d="M-60 -140 Q-40 -156 -10 -148 Q10 -160 40 -150 Q62 -148 60 -136 Q20 -142 -60 -140Z" fill="#fff" opacity=".92" />
        <path d="M-82 -92 Q-60 -104 -30 -97 Q0 -108 34 -98 Q64 -104 84 -92 Q40 -96 -82 -92Z" fill="#fff" opacity=".9" />
        <path d="M-50 -132 Q-40 -122 -46 -112 M30 -132 Q38 -118 32 -106" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".7" />
      </g>
    </g>
  );
}

/* ───────── Escena ───────── */
const PARK_Z = 0.7, AWAY_Z = -3.4;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function GarageScene({ status }: { status: Status | null }) {
  const carRef = useRef<SVGGElement>(null);
  const brakeRef = useRef<SVGGElement>(null);
  const revRef = useRef<SVGGElement>(null);
  const zRef = useRef(AWAY_Z);
  const raf = useRef(0);
  const parked = status === "OCUPADO";

  // Animación del auto: entra de frente a la cámara hasta la fosa, o sale en reversa.
  useEffect(() => {
    const car = carRef.current, brake = brakeRef.current, rev = revRef.current;
    if (!car || !brake || !rev) return;
    const draw = (z: number, bounce = 0, alpha = 1) => {
      const s = sc(z) / 100;
      car.setAttribute("transform", `translate(${CX} ${(Y(0, z) + bounce * s).toFixed(2)}) scale(${s.toFixed(4)})`);
      car.style.opacity = String(alpha);
    };
    const from = zRef.current, to = parked ? PARK_Z : AWAY_Z;
    cancelAnimationFrame(raf.current);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (from === to || reduce) {
      zRef.current = to;
      draw(to, 0, to === AWAY_Z ? 0 : 1);
      brake.style.opacity = "0"; rev.style.opacity = "0";
      return;
    }
    const entering = to > from;
    const dur = entering ? 3200 : 2600;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const k = entering ? easeOut(t) : easeInOut(t);
      const z = from + (to - from) * k;
      zRef.current = z;
      const fade = entering ? Math.min(1, t * 5) : Math.min(1, (1 - t) * 4);
      draw(z, 0, fade);
      brake.style.opacity = entering && t > 0.55 ? "1" : "0";
      rev.style.opacity = entering ? "0" : t < 0.9 ? "1" : "0";
      if (t < 1) raf.current = requestAnimationFrame(step);
      else if (entering) settle(performance.now());
    };
    // al frenar, la suspensión rebota un poco y suelta el freno
    const settle = (s0: number) => {
      const tick = (now: number) => {
        const e = (now - s0) / 700;
        draw(PARK_Z, Math.sin(e * Math.PI * 2.2) * 2.2 * Math.max(0, 1 - e));
        if (e > 0.9) brake.style.opacity = "0";
        if (e < 1.2) raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [parked]);

  const sig = status === "LIBRE" || status === "OCUPADO" ? SIG[status] : null;
  const closed = status === "CERRADO";

  return (
    <svg viewBox="0 14 400 530" className="block h-auto w-full select-none" role="img"
      aria-label={status ? `Garage en vivo: ${status.toLowerCase()}` : "Garage en vivo: conectando"}>
      <defs>
        <filter id="lg-blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="lg-glow-sm" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="lg-glow-lg" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="9" /></filter>
        <linearGradient id="lg-facade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d0d0e" /><stop offset="1" stopColor="#1b1b1d" /></linearGradient>
        <linearGradient id="lg-drive" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1e1e20" /><stop offset="1" stopColor="#080809" /></linearGradient>
        <linearGradient id="lg-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6f5f1" /><stop offset="1" stopColor="#e2e0da" /></linearGradient>
        <linearGradient id="lg-wallL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#c9c6bf" /><stop offset="1" stopColor="#eeede8" /></linearGradient>
        <linearGradient id="lg-wallR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stopColor="#c9c6bf" /><stop offset="1" stopColor="#eeede8" /></linearGradient>
        <linearGradient id="lg-ceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bfbdb7" /><stop offset="1" stopColor="#e6e4de" /></linearGradient>
        <linearGradient id="lg-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a3a19c" /><stop offset="1" stopColor="#6c6a66" /></linearGradient>
        <linearGradient id="lg-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b1c1e" /><stop offset="1" stopColor="#0b0b0c" /></linearGradient>
        <linearGradient id="lg-paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c3c7cb" /><stop offset=".38" stopColor="#8e9399" /><stop offset=".7" stopColor="#62676d" /><stop offset="1" stopColor="#3b3e42" /></linearGradient>
        <linearGradient id="lg-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2b3138" /><stop offset="1" stopColor="#0b0d10" /></linearGradient>
        <linearGradient id="lg-shutter" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5d6065" /><stop offset=".5" stopColor="#45484c" /><stop offset="1" stopColor="#2f3134" /></linearGradient>
        <pattern id="lg-slats" width="8" height="7" patternUnits="userSpaceOnUse"><rect width="8" height="7" fill="url(#lg-shutter)" /><rect y="5.6" width="8" height="1.4" fill="#1d1e20" /><rect y="0" width="8" height=".7" fill="#7b7f84" opacity=".6" /></pattern>
        <radialGradient id="lg-lamp"><stop offset="0" stopColor="#fff6dc" stopOpacity=".55" /><stop offset="1" stopColor="#fff6dc" stopOpacity="0" /></radialGradient>
        <radialGradient id="lg-spill"><stop offset="0" stopColor={sig ?? "#000"} stopOpacity=".55" /><stop offset="1" stopColor={sig ?? "#000"} stopOpacity="0" /></radialGradient>
        <clipPath id="lg-door"><rect x={ENTRANCE.x0} y={ENTRANCE.y0} width={ENTRANCE.x1 - ENTRANCE.x0} height={ENTRANCE.y1 - ENTRANCE.y0} /></clipPath>
      </defs>

      {/* ─── Interior ─── */}
      <g clipPath="url(#lg-door)">
        <polygon points={poly([-W, H, 0], [W, H, 0], [W, H, D], [-W, H, D])} fill="url(#lg-ceil)" />
        <polygon points={poly([-W, 0, 0], [-W, H, 0], [-W, H, D], [-W, 0, D])} fill="url(#lg-wallL)" />
        <polygon points={poly([W, 0, 0], [W, H, 0], [W, H, D], [W, 0, D])} fill="url(#lg-wallR)" />
        <polygon points={poly([-W, 0, D], [W, 0, D], [W, H, D], [-W, H, D])} fill="url(#lg-back)" />
        <path d={TILES_BACK + TILES_L + TILES_R} stroke="#b9b5ac" strokeWidth=".55" fill="none" />
        {/* brillo del azulejo */}
        <polygon points={poly([-W, 0.4, 0.3], [-W, 2.3, 0.3], [-W, 2.3, 2.2], [-W, 0.4, 1.4])} fill="#fff" opacity=".18" />
        <polygon points={poly([W, 0.6, 1], [W, 2.4, 1.2], [W, 2.4, 3], [W, 0.6, 2.4])} fill="#fff" opacity=".12" />
        {/* logo en la pared del fondo, como el real */}
        <g transform={`translate(${CX} ${Y(1.78, D).toFixed(1)}) scale(.13)`} opacity=".9">
          <path d="M-52-62 L0-78 L52-62 V8 Q52 46 0 74 Q-52 46 -52 8Z" fill="none" stroke="#9c8b5e" strokeWidth="5" />
          <g fill="#a8915a" transform="skewX(-10)"><path d="M-26-38h14l-8 52h26l-2 11h-38z" /><path d="M6-38h34l-2 10H16l-5 30h14l1-8h-8l1-9h22l-5 30H4z" /></g>
        </g>
        <text x={CX} y={Y(1.3, D)} textAnchor="middle" fontSize="4.6" letterSpacing="1.4" fill="#8f8a7d" style={{ fontFamily: "var(--font-display)" }}>LUXE GARAGE</text>
        {/* piso y fosa de acero negro */}
        <polygon points={poly([-W, 0, 0], [W, 0, 0], [W, 0, D], [-W, 0, D])} fill="url(#lg-floor)" />
        <polygon points={poly([-FX, 0, FZ0], [FX, 0, FZ0], [FX, 0, FZ1], [-FX, 0, FZ1])} fill="#030303" />
        {PANELS.map((pn, i) => (
          <g key={i}>
            <polygon points={pn.poly} fill="url(#lg-steel)" />
            <path d={pn.bars} stroke="#34363a" strokeWidth=".45" fill="none" />
          </g>
        ))}
        {/* reflejo de los tubos en el piso mojado */}
        <polygon points={poly([-0.82, 0, 0.3], [-0.68, 0, 0.3], [-0.68, 0, 5.6], [-0.82, 0, 5.6])} fill="#fff" opacity=".16" filter="url(#lg-glow-sm)" />
        <polygon points={poly([0.68, 0, 0.3], [0.82, 0, 0.3], [0.82, 0, 5.6], [0.68, 0, 5.6])} fill="#fff" opacity=".16" filter="url(#lg-glow-sm)" />
        {/* tubos fluorescentes */}
        <g className="lg-fluor">
          {[-0.75, 0.75].map((x) => (
            <g key={x}>
              <polygon points={poly([x - 0.12, H - 0.01, 0.3], [x + 0.12, H - 0.01, 0.3], [x + 0.12, H - 0.01, 5.7], [x - 0.12, H - 0.01, 5.7])} fill="#fffbe8" opacity=".5" filter="url(#lg-glow-lg)" />
              <polygon points={poly([x - 0.03, H - 0.02, 0.4], [x + 0.03, H - 0.02, 0.4], [x + 0.03, H - 0.02, 5.6], [x - 0.03, H - 0.02, 5.6])} fill="#fffef6" />
            </g>
          ))}
        </g>
        {/* sombra de la orilla de la puerta */}
        <rect x={ENTRANCE.x0} y={ENTRANCE.y0} width={ENTRANCE.x1 - ENTRANCE.x0} height={ENTRANCE.y1 - ENTRANCE.y0} fill="none" stroke="#000" strokeWidth="10" opacity=".35" filter="url(#lg-blur)" />
      </g>

      {/* ─── Exterior: fachada y entrada ─── */}
      <path fillRule="evenodd" fill="url(#lg-facade)"
        d={`M0 0H400V${ENTRANCE.y1}H0Z M${ENTRANCE.x0} ${ENTRANCE.y0}H${ENTRANCE.x1}V${ENTRANCE.y1}H${ENTRANCE.x0}Z`} />
      <rect x="0" y={ENTRANCE.y1} width="400" height={600 - ENTRANCE.y1} fill="url(#lg-drive)" />
      <path d={[seg([-W, 0, 0], [-W, 0, -3.3]), seg([W, 0, 0], [W, 0, -3.3]), seg([-2.6, 0, -1.4], [2.6, 0, -1.4]), seg([-2.6, 0, -2.6], [2.6, 0, -2.6])].join("")} stroke="#2a2a2d" strokeWidth=".8" />
      {/* luz del interior que sale al piso */}
      <polygon points={poly([-W, 0, 0], [W, 0, 0], [W * 1.5, 0, -2.6], [-W * 1.5, 0, -2.6])} fill="#fff8e6" opacity=".06" />
      {/* color de estado que baña la entrada */}
      <ellipse cx={CX} cy={ENTRANCE.y1 + 40} rx="220" ry="80" fill="url(#lg-spill)" className="lg-fade" opacity={sig ? 1 : 0} />
      <ellipse cx="38" cy="240" rx="80" ry="120" fill="url(#lg-spill)" className="lg-fade" opacity={sig ? 0.9 : 0} />

      {/* flechas de luz verde en el piso: “pasa” */}
      {CHEVRONS.map((c, i) => (
        <polygon key={i} points={c} fill={status === "LIBRE" ? SIG.LIBRE : "#202022"}
          className={status === "LIBRE" ? "lg-chevron" : ""} style={{ animationDelay: `${i * 0.22}s` }}
          filter={status === "LIBRE" ? "url(#lg-glow-sm)" : undefined} />
      ))}
      {/* franja LED del umbral */}
      <line x1={ENTRANCE.x0} y1={ENTRANCE.y1} x2={ENTRANCE.x1} y2={ENTRANCE.y1} stroke={sig ?? "#222"} strokeWidth="2.6" className="lg-fade" filter={sig ? "url(#lg-glow-sm)" : undefined} />

      {/* cortina de acero (cerrado) */}
      <g clipPath="url(#lg-door)">
        <g className="lg-shutter" style={{ transform: `translateY(${closed ? 0 : -(ENTRANCE.y1 - ENTRANCE.y0) - 4}px)` }}>
          <rect x={ENTRANCE.x0} y={ENTRANCE.y0} width={ENTRANCE.x1 - ENTRANCE.x0} height={ENTRANCE.y1 - ENTRANCE.y0} fill="url(#lg-slats)" />
          <rect x={ENTRANCE.x0} y={ENTRANCE.y1 - 6} width={ENTRANCE.x1 - ENTRANCE.x0} height="6" fill="#18191b" />
          <rect x={CX - 14} y={ENTRANCE.y1 - 12} width="28" height="4" rx="2" fill="#0e0f10" />
        </g>
      </g>
      {/* caja de la cortina y dintel */}
      <rect x={ENTRANCE.x0 - 6} y={ENTRANCE.y0 - 12} width={ENTRANCE.x1 - ENTRANCE.x0 + 12} height="13" rx="2" fill="#0b0b0c" stroke="#232325" />

      {/* letrero como el de la fachada real */}
      <g>
        <path d="M128 30 q4 -14 14 -12 M272 30 q-4 -14 -14 -12" stroke="#2c2c2e" strokeWidth="2" fill="none" />
        <ellipse cx="200" cy="64" rx="150" ry="46" fill="url(#lg-lamp)" opacity=".5" />
        <rect x="70" y="40" width="260" height="80" rx="3" fill="#050505" stroke="#3b331d" />
        <rect x="74" y="44" width="252" height="72" rx="2" fill="none" stroke="#c9a54a" strokeOpacity=".55" strokeWidth=".8" />
        <g transform="translate(108 80) scale(.34)">
          <path d="M-52-62 L0-78 L52-62 V8 Q52 46 0 74 Q-52 46 -52 8Z" fill="none" stroke="url(#lg-goldv)" strokeWidth="5" />
          <g fill="url(#lg-goldv)" transform="skewX(-10)"><path d="M-26-38h14l-8 52h26l-2 11h-38z" /><path d="M6-38h34l-2 10H16l-5 30h14l1-8h-8l1-9h22l-5 30H4z" /></g>
        </g>
        <linearGradient id="lg-goldv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6e2a0" /><stop offset=".55" stopColor="#d4af37" /><stop offset="1" stopColor="#8a6d1a" /></linearGradient>
        <text x="232" y="84" textAnchor="middle" fontSize="19" fontWeight="600" letterSpacing="2.5" fill="url(#lg-goldv)" style={{ fontFamily: "var(--font-display)" }}>LUXE GARAGE</text>
        <text x="232" y="101" textAnchor="middle" fontSize="6.2" letterSpacing="2.4" fill="#bfa45a" style={{ fontFamily: "var(--font-sans)" }}>AUTO DETAILING &amp; CAR CARE</text>
      </g>

      {/* semáforo del lado del conductor */}
      <g className="lg-power"><Semaforo status={status} x={12} y={176} /></g>

      {/* el auto */}
      <g ref={carRef} style={{ opacity: 0 }}>
        <Accord brakeRef={brakeRef} revRef={revRef} foam={parked} />
      </g>
    </svg>
  );
}
