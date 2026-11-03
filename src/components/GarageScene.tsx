"use client";
import { useEffect, useRef, useState } from "react";

export type Status = "LIBRE" | "OCUPADO" | "CERRADO";

/* ───────── Perspectiva de un punto: parados DENTRO del pasillo de azulejo blanco, mirando hacia la bahía ─────────
   Metros aprox.: pasillo 5.2 m de ancho × 3.5 m de alto; al fondo (z=0) la pared con la entrada de la bahía
   de 3.2 × 2.5 m; la bahía mide 6 m de fondo. La cámara está 8 m antes de esa pared, a 1.5 m del piso. */
const F = 440, ZC = 8, CAM = 1.5, HZ = 300, CX = 200;
const CW = 2.6, CH = 3.5, ZN = -6.5; // pasillo: medio ancho, alto, z más cercano a la cámara
const W = 1.6, H = 2.5, D = 6; // bahía: medio ancho, alto, fondo
const sc = (z: number) => F / (z + ZC);
const X = (x: number, z: number) => CX + x * sc(z);
const Y = (y: number, z: number) => HZ + (CAM - y) * sc(z);
type V = [number, number, number];
const p = ([x, y, z]: V) => `${X(x, z).toFixed(1)},${Y(y, z).toFixed(1)}`;
const poly = (...v: V[]) => v.map(p).join(" ");
const seg = (a: V, b: V) => `M${p(a)}L${p(b)}`;
const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
/** franja horizontal (piso o techo) a lo largo de z, centrada en x */
const strip = (x: number, hw: number, y: number, za: number, zb: number) => poly([x - hw, y, za], [x + hw, y, za], [x + hw, y, zb], [x - hw, y, zb]);
/** rectángulo de frente a la cámara (z constante) en coordenadas de pantalla */
const face = (x0: number, y0: number, x1: number, y1: number, z: number) => ({ x: X(x0, z), y: Y(y1, z), w: X(x1, z) - X(x0, z), h: Y(y0, z) - Y(y1, z) });

/* ───────── Pasillo ───────── */
const END = { x0: X(-CW, 0), x1: X(CW, 0), y0: Y(CH, 0), y1: Y(0, 0) };
const DOOR = { x0: X(-W, 0), x1: X(W, 0), y0: Y(H, 0), y1: Y(0, 0) };
const DW = DOOR.x1 - DOOR.x0, DH = DOOR.y1 - DOOR.y0;

// Azulejo de la pared del fondo, alrededor del hueco de la bahía.
const TILES_END = [
  ...range(-CW, CW, 18).map((x) => (Math.abs(x) < W ? seg([x, H, 0], [x, CH, 0]) : seg([x, 0, 0], [x, CH, 0]))),
  ...range(0, CH, 12).map((y) => (y < H ? seg([-CW, y, 0], [-W, y, 0]) + seg([W, y, 0], [CW, y, 0]) : seg([-CW, y, 0], [CW, y, 0]))),
].join("");
// Azulejo de las paredes del pasillo (convergen hacia la entrada).
const tilesCorr = (s: number) =>
  [...range(-3.3, 0, 11).map((z) => seg([s * CW, 0, z], [s * CW, CH, z])), ...range(0, CH, 12).map((y) => seg([s * CW, y, -4], [s * CW, y, 0]))].join("");
const TILES_CORR = tilesCorr(-1) + tilesCorr(1);
// Plafón del techo.
const CEIL_GRID = [
  ...[-1.95, -0.65, 0.65, 1.95].map((x) => seg([x, CH, ZN], [x, CH, 0])),
  ...range(-4.55, -0.65, 6).map((z) => seg([-CW, CH, z], [CW, CH, z])),
].join("");
const FLOOR_JOINTS = [-1.7, -3.5, -5.3].map((z) => seg([-CW, 0, z], [CW, 0, z])).join("");
// Sombra de contacto en las esquinas (piso–pared y pared–techo).
const AO_FLOOR = [seg([-CW, 0, -4], [-CW, 0, 0]), seg([-CW, 0, 0], [-W, 0, 0]), seg([W, 0, 0], [CW, 0, 0]), seg([CW, 0, 0], [CW, 0, -4])].join("");
const AO_TOP = [seg([-CW, 0, 0], [-CW, CH, 0]), seg([CW, 0, 0], [CW, CH, 0]), seg([-CW, CH, 0], [CW, CH, 0]), seg([-CW, CH, -4], [-CW, CH, 0]), seg([CW, CH, -4], [CW, CH, 0])].join("");
// Tubos fluorescentes del pasillo: dos hileras de lámparas.
const TUBES: [number, number, number][] = [-1.25, 1.25].flatMap((x) => [[-5.9, -4.7], [-3.9, -2.7], [-1.9, -0.7]].map(([a, b]) => [x, a, b] as [number, number, number]));

// Flechas de luz en el piso del pasillo, apuntando hacia la bahía.
const CHEVRONS = [-4.4, -3.4, -2.4, -1.4].map((z) =>
  poly([-0.6, 0, z], [0, 0, z + 0.42], [0.6, 0, z], [0.6, 0, z + 0.2], [0, 0, z + 0.62], [-0.6, 0, z + 0.2]),
);

/* ───────── Bahía (lo que se ve por la entrada) ───────── */
const TILES_BACK = [
  ...range(-W, W, 12).map((x) => seg([x, 0, D], [x, H, D])),
  ...range(0, H, 10).map((y) => seg([-W, y, D], [W, y, D])),
].join("");
const tilesSide = (s: number) =>
  [...range(0, D, 20).map((z) => seg([s * W, 0, z], [s * W, H, z])), ...range(0, H, 10).map((y) => seg([s * W, y, 0], [s * W, y, D]))].join("");
const TILES_BAY = tilesSide(-1) + tilesSide(1);

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

/* ───────── Piezas montadas en la pared del fondo ───────── */
const SEM_K = 0.88; // semáforo (44×124 a escala 1) a la izquierda de la entrada, lado del conductor
const SEM = { x: X(-2.1, 0) - 22 * SEM_K, y: Y(2.42, 0) };
const SEM_CX = X(-2.1, 0), SEM_BOTTOM = SEM.y + 124 * SEM_K;
const LAMP_Y = { OCUPADO: SEM.y + 34 * SEM_K, LIBRE: SEM.y + 90 * SEM_K };
const SIGN = face(-1.75, 2.7, 1.75, 3.38, -0.12); // letrero LUXE GARAGE sobre la entrada
const HOUSING = face(-1.74, 2.5, 1.74, 2.64, -0.16); // caja de la cortina
const LED = face(-1.2, 2.07, 1.2, 2.47, -0.05); // display de matriz de puntos bajo el dintel
const RAIL_L = face(-W - 0.08, 0, -W, H, -0.02), RAIL_R = face(W, 0, W + 0.08, H, -0.02);

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
const BODY = "M-91 -24 L-94 -60 Q-94 -84 -84 -91 Q0 -96 84 -91 Q94 -84 94 -60 L91 -24Z";
function Accord({ brakeRef, revRef, foam }: { brakeRef: React.Ref<SVGGElement>; revRef: React.Ref<SVGGElement>; foam: boolean }) {
  const lampL = "M-93 -83 L-58 -85 L-56 -75 L-91 -71 Z";
  const lampR = "M93 -83 L58 -85 L56 -75 L91 -71 Z";
  return (
    <g>
      {/* reflejo en el piso pulido */}
      <g transform="scale(1 -1)" opacity=".14" filter="url(#lg-blur)">
        <rect x="-93" y="-34" width="27" height="34" fill="#0a0a0a" />
        <rect x="66" y="-34" width="27" height="34" fill="#0a0a0a" />
        <path d={BODY} fill="url(#lg-paint)" />
        <path d={lampL} fill="#e0261d" />
        <path d={lampR} fill="#e0261d" />
      </g>
      {/* sombra de contacto */}
      <ellipse cx="0" cy="-1" rx="112" ry="12" fill="#2a2620" opacity=".42" filter="url(#lg-blur)" />
      <ellipse cx="0" cy="0" rx="98" ry="4" fill="#000" opacity=".55" filter="url(#lg-soft)" />
      {/* llantas */}
      <rect x="-93" y="-34" width="27" height="34" rx="5" fill="#0a0a0a" />
      <rect x="66" y="-34" width="27" height="34" rx="5" fill="#0a0a0a" />
      {/* espejos */}
      <path d="M-92 -106 Q-106 -108 -108 -99 Q-104 -94 -92 -97Z" fill="url(#lg-paint)" />
      <path d="M92 -106 Q106 -108 108 -99 Q104 -94 92 -97Z" fill="url(#lg-paint)" />
      {/* cabina (pilares C) y medallón */}
      <path d="M-78 -90 L-61 -133 Q-52 -145 -30 -146 L30 -146 Q52 -145 61 -133 L78 -90Z" fill="url(#lg-paint)" />
      <path d="M-66 -93 L-51 -131 Q-45 -139 -28 -140 L28 -140 Q45 -139 51 -131 L66 -93 Q0 -88 -66 -93Z" fill="url(#lg-glass)" />
      <path d="M-40 -136 L-14 -136 L-38 -96 L-56 -96Z" fill="#fff" opacity=".1" />
      <path d="M8 -136 L22 -136 L4 -95 L-8 -95Z" fill="#fff" opacity=".07" />
      {/* carrocería */}
      <path d={BODY} fill="url(#lg-paint)" />
      <path d="M-84 -91 Q0 -96 84 -91 L82 -87 Q0 -91 -82 -87Z" fill="#f2f4f6" opacity=".6" />
      <path d="M-90 -64 Q0 -67 90 -64" stroke="#fff" strokeOpacity=".22" strokeWidth="1.2" fill="none" />
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

/* Escudo del logotipo (mismo trazo que el letrero real). */
function Shield({ fill }: { fill: string }) {
  return (
    <>
      <path d="M-52-62 L0-78 L52-62 V8 Q52 46 0 74 Q-52 46 -52 8Z" fill="none" stroke={fill} strokeWidth="5" />
      <g fill={fill} transform="skewX(-10)"><path d="M-26-38h14l-8 52h26l-2 11h-38z" /><path d="M6-38h34l-2 10H16l-5 30h14l1-8h-8l1-9h22l-5 30H4z" /></g>
    </>
  );
}

/* ───────── Escena ───────── */
const PARK_Z = 0.8, AWAY_Z = -6;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const SANS = { fontFamily: "var(--font-sans)" };
const DISPLAY = { fontFamily: "var(--font-display)" };

/* ───────── Marcador colgante de neón (dígitos de 7 segmentos) ───────── */
const SB = face(-0.95, 2.72, 0.95, 3.3, -3); // caja del marcador, colgada del techo del pasillo
const SB_CEIL = Y(CH, -3);
const SEGS: Record<string, string> = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg", " ": "" };
function Digit({ x, y, w, h, ch, on }: { x: number; y: number; w: number; h: number; ch: string; on: string }) {
  const t = w * 0.2, hh = h / 2;
  const r: Record<string, [number, number, number, number]> = {
    a: [x + t, y, w - 2 * t, t], b: [x + w - t, y + t, t, hh - 1.5 * t], c: [x + w - t, y + hh + 0.5 * t, t, hh - 1.5 * t],
    d: [x + t, y + h - t, w - 2 * t, t], e: [x, y + hh + 0.5 * t, t, hh - 1.5 * t], f: [x, y + t, t, hh - 1.5 * t], g: [x + t, y + hh - t / 2, w - 2 * t, t],
  };
  const lit = SEGS[ch] ?? "";
  return (
    <g>
      {Object.entries(r).map(([k, [rx, ry, rw, rh]]) => (
        <rect key={k} x={rx} y={ry} width={rw} height={rh} rx={t / 2} fill={lit.includes(k) ? on : "#2a2410"} opacity={lit.includes(k) ? 1 : 0.85} />
      ))}
    </g>
  );
}
function useMxClock() {
  const [c, setC] = useState<{ h: number; m: number; s: number } | null>(null);
  useEffect(() => {
    const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: false });
    const tick = () => {
      const p = f.formatToParts(new Date());
      const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
      setC({ h: g("hour") % 24, m: g("minute"), s: g("second") });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return c;
}
function Scoreboard({ status, busy, opens }: { status: Status | null; busy: string | null; opens?: string }) {
  const c = useMxClock();
  const neon = "#f6d36b"; // neón oro (paleta: negro · crema · oro)
  const h12 = c ? String(c.h % 12 || 12).padStart(2, " ") : "  ";
  const mm = c ? String(c.m).padStart(2, "0") : "  ";
  const ap = c ? (c.h < 12 ? "AM" : "PM") : "";
  const row = status === "LIBRE" ? { t: "LIBRE · PASA", c: "#3dff8f" } : status === "OCUPADO" ? { t: busy ? `OCUPADO · ${busy}` : "OCUPADO", c: "#ff4b3e" }
    : status === "CERRADO" ? { t: opens ?? "CERRADO", c: "#e8c25a" } : { t: "EN VIVO", c: "#f6e2a0" };
  const pad = SB.w * 0.07, dh = SB.h * 0.5, dw = dh * 0.56, gap = dw * 0.28;
  const x0 = SB.x + pad, y0 = SB.y + SB.h * 0.12;
  const xs = [x0, x0 + dw + gap, x0 + 2 * dw + gap * 3.2, x0 + 3 * dw + gap * 4.2];
  const colon = x0 + 2 * dw + gap * 1.6;
  return (
    <g aria-hidden>
      {/* cables al techo */}
      <path d={`M${SB.x + SB.w * 0.18} ${SB_CEIL} V${SB.y} M${SB.x + SB.w * 0.82} ${SB_CEIL} V${SB.y}`} stroke="#3a3a3d" strokeWidth="1.1" />
      <rect x={SB.x + 3} y={SB.y + 6} width={SB.w} height={SB.h} rx="5" fill="#000" opacity=".25" filter="url(#lg-soft)" />
      <rect x={SB.x} y={SB.y} width={SB.w} height={SB.h} rx="5" fill="#0b0b0c" stroke="#2c2c2f" strokeWidth="1.5" />
      <rect x={SB.x + 2.5} y={SB.y + 2.5} width={SB.w - 5} height={SB.h - 5} rx="3.5" fill="none" stroke="#c9a54a" strokeOpacity=".45" strokeWidth=".7" />
      <g filter="url(#lg-glow-sm)">
        <Digit x={xs[0]} y={y0} w={dw} h={dh} ch={h12[0]} on={neon} />
        <Digit x={xs[1]} y={y0} w={dw} h={dh} ch={h12[1]} on={neon} />
        <g className="lg-colon">
          <circle cx={colon} cy={y0 + dh * 0.3} r={dw * 0.11} fill={neon} />
          <circle cx={colon} cy={y0 + dh * 0.72} r={dw * 0.11} fill={neon} />
        </g>
        <Digit x={xs[2]} y={y0} w={dw} h={dh} ch={mm[0]} on={neon} />
        <Digit x={xs[3]} y={y0} w={dw} h={dh} ch={mm[1]} on={neon} />
        <text x={SB.x + SB.w - pad * 0.7} y={y0 + dh * 0.42} textAnchor="end" fontSize={dh * 0.3} fontWeight="800" fill={neon} style={SANS}>{ap}</text>
        <text x={SB.x + SB.w - pad * 0.7} y={y0 + dh * 0.92} textAnchor="end" fontSize={dh * 0.2} fontWeight="700" letterSpacing=".6" fill="#c9a54a" style={SANS}>ZAMORA</text>
        <text x={SB.x + SB.w / 2} y={SB.y + SB.h * 0.9} textAnchor="middle" fontSize={SB.h * 0.17} fontWeight="800" letterSpacing="1" fill={row.c} style={SANS}
          {...(row.t.length * SB.h * 0.12 > SB.w - 10 ? { textLength: SB.w - 10, lengthAdjust: "spacingAndGlyphs" as const } : {})}>{row.t}</text>
      </g>
    </g>
  );
}

export default function GarageScene({ status, opensShort, busyShort }: { status: Status | null; opensShort?: string; busyShort?: string }) {
  const carRef = useRef<SVGGElement>(null);
  const brakeRef = useRef<SVGGElement>(null);
  const revRef = useRef<SVGGElement>(null);
  const zRef = useRef(AWAY_Z);
  const raf = useRef(0);
  const parked = status === "OCUPADO";

  // Animación del auto: entra desde junto a la cámara por el pasillo hasta la fosa, o sale en reversa.
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
    const dur = entering ? 3400 : 2600;
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
  const busy = status === "OCUPADO" && busyShort ? busyShort.toUpperCase() : null;
  const [busyA, ...busyB] = busy ? busy.split(" ") : [];
  const busyMax = LED.w - 12;
  const busyFit = busy && busy.length * 8.6 > busyMax ? { textLength: busyMax, lengthAdjust: "spacingAndGlyphs" as const } : {};
  const opensFit = opensShort && opensShort.length * 7.4 > 150 ? { textLength: 150, lengthAdjust: "spacingAndGlyphs" as const } : {};
  const shutterY = closed ? 0 : -DH - 4;
  const label = !status
    ? "Garage en vivo: conectando"
    : status === "LIBRE"
      ? "Garage en vivo: libre, puedes pasar"
      : status === "OCUPADO"
        ? `Garage en vivo: ocupado${busyShort ? `, ${busyShort.toLowerCase()}` : ""}`
        : `Garage en vivo: cerrado${opensShort ? `, ${opensShort.toLowerCase()}` : ""}`;

  return (
    <svg viewBox="0 0 400 600" className="block h-auto w-full select-none" role="img" aria-label={label}>
      <style>{`
        .lg-halo{animation:lgHalo 2.8s ease-in-out infinite}
        @keyframes lgHalo{0%,100%{opacity:.6}50%{opacity:.95}}
        .lg-dm{animation:lgDm 3.4s ease-in-out infinite}
        @keyframes lgDm{0%,100%{opacity:1}50%{opacity:.8}}
        .lg-colon{animation:lgColon 1s steps(1) infinite}
        @keyframes lgColon{50%{opacity:.15}}
        @media (prefers-reduced-motion: reduce){.lg-halo,.lg-dm,.lg-colon{animation:none}}
      `}</style>
      <defs>
        <filter id="lg-blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="lg-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.8" /></filter>
        <filter id="lg-glow-sm" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="lg-glow-lg" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="9" /></filter>
        {/* pasillo */}
        <linearGradient id="lg-c-ceil" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={END.y0}><stop offset="0" stopColor="#e2e0da" /><stop offset="1" stopColor="#f1f0eb" /></linearGradient>
        <linearGradient id="lg-c-wallL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={END.x0} y2="0"><stop offset="0" stopColor="#e0ded7" /><stop offset="1" stopColor="#f7f6f2" /></linearGradient>
        <linearGradient id="lg-c-wallR" gradientUnits="userSpaceOnUse" x1="400" y1="0" x2={END.x1} y2="0"><stop offset="0" stopColor="#dddbd4" /><stop offset="1" stopColor="#f5f4f0" /></linearGradient>
        <linearGradient id="lg-c-end" gradientUnits="userSpaceOnUse" x1="0" y1={END.y0} x2="0" y2={END.y1}><stop offset="0" stopColor="#fbfaf7" /><stop offset="1" stopColor="#ebe9e3" /></linearGradient>
        <linearGradient id="lg-c-floor" gradientUnits="userSpaceOnUse" x1="0" y1={END.y1} x2="0" y2="600"><stop offset="0" stopColor="#d9d8d3" /><stop offset=".45" stopColor="#c6c5c0" /><stop offset="1" stopColor="#a7a6a1" /></linearGradient>
        <linearGradient id="lg-refl" gradientUnits="userSpaceOnUse" x1="0" y1={DOOR.y1} x2="0" y2={DOOR.y1 + DH * 0.7}><stop offset="0" stopColor="#fffdf4" stopOpacity=".85" /><stop offset="1" stopColor="#fffdf4" stopOpacity="0" /></linearGradient>
        <linearGradient id="lg-box" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a3a6ab" /><stop offset="1" stopColor="#6d7075" /></linearGradient>
        <linearGradient id="lg-rail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#6c6f74" /><stop offset=".5" stopColor="#b9bcc0" /><stop offset="1" stopColor="#585b60" /></linearGradient>
        {/* bahía */}
        <linearGradient id="lg-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbfaf6" /><stop offset="1" stopColor="#e9e7e1" /></linearGradient>
        <linearGradient id="lg-wallL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#d9d6cf" /><stop offset="1" stopColor="#f4f3ef" /></linearGradient>
        <linearGradient id="lg-wallR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stopColor="#d9d6cf" /><stop offset="1" stopColor="#f4f3ef" /></linearGradient>
        <linearGradient id="lg-ceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d3d1cb" /><stop offset="1" stopColor="#efeee9" /></linearGradient>
        <linearGradient id="lg-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d2d0cb" /><stop offset="1" stopColor="#b2b0ab" /></linearGradient>
        <linearGradient id="lg-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b1c1e" /><stop offset="1" stopColor="#0b0b0c" /></linearGradient>
        {/* auto, cortina, letreros */}
        <linearGradient id="lg-paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c3c7cb" /><stop offset=".38" stopColor="#8e9399" /><stop offset=".7" stopColor="#62676d" /><stop offset="1" stopColor="#3b3e42" /></linearGradient>
        <linearGradient id="lg-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a424b" /><stop offset="1" stopColor="#0b0d10" /></linearGradient>
        <linearGradient id="lg-shutter" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8d9095" /><stop offset=".5" stopColor="#74777c" /><stop offset="1" stopColor="#5a5d61" /></linearGradient>
        <pattern id="lg-slats" width="8" height="7" patternUnits="userSpaceOnUse"><rect width="8" height="7" fill="url(#lg-shutter)" /><rect y="5.6" width="8" height="1.4" fill="#3c3e41" /><rect y="0" width="8" height=".7" fill="#c4c7cb" opacity=".6" /></pattern>
        <pattern id="lg-led" width="2.6" height="2.6" patternUnits="userSpaceOnUse"><path fillRule="evenodd" fill="#070707" opacity=".72" d="M0 0H2.6V2.6H0Z M1.3 .35 A.95 .95 0 1 0 1.301 .35Z" /></pattern>
        <linearGradient id="lg-goldv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6e2a0" /><stop offset=".55" stopColor="#d4af37" /><stop offset="1" stopColor="#8a6d1a" /></linearGradient>
        {/* luz */}
        <radialGradient id="lg-spill"><stop offset="0" stopColor={sig ?? "#fff"} stopOpacity=".5" /><stop offset="1" stopColor={sig ?? "#fff"} stopOpacity="0" /></radialGradient>
        <radialGradient id="lg-amber"><stop offset="0" stopColor="#e8c25a" stopOpacity=".55" /><stop offset="1" stopColor="#e8c25a" stopOpacity="0" /></radialGradient>
        <radialGradient id="lg-vig" cx=".5" cy=".5" r=".72"><stop offset=".6" stopColor="#1a1712" stopOpacity="0" /><stop offset="1" stopColor="#1a1712" stopOpacity=".2" /></radialGradient>
        <linearGradient id="lg-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a1712" /><stop offset="1" stopColor="#0b0b0c" /></linearGradient>
        <clipPath id="lg-door"><rect x={DOOR.x0} y={DOOR.y0} width={DW} height={DH} /></clipPath>
      </defs>

      {/* ─── Pasillo: techo, paredes y piso ─── */}
      <polygon points={poly([-CW, CH, ZN], [CW, CH, ZN], [CW, CH, 0], [-CW, CH, 0])} fill="url(#lg-c-ceil)" />
      <path d={CEIL_GRID} stroke="#cfcdc6" strokeWidth=".7" fill="none" />
      <polygon points={poly([-CW, 0, ZN], [-CW, CH, ZN], [-CW, CH, 0], [-CW, 0, 0])} fill="url(#lg-c-wallL)" />
      <polygon points={poly([CW, 0, ZN], [CW, CH, ZN], [CW, CH, 0], [CW, 0, 0])} fill="url(#lg-c-wallR)" />
      <polygon points={poly([-CW, 0, ZN], [-CW, 0.12, ZN], [-CW, 0.12, 0], [-CW, 0, 0])} fill="#bdbab2" />
      <polygon points={poly([CW, 0, ZN], [CW, 0.12, ZN], [CW, 0.12, 0], [CW, 0, 0])} fill="#bdbab2" />
      <path d={TILES_CORR} stroke="#cbc8c0" strokeWidth=".6" fill="none" />
      {/* brillo del azulejo vidriado */}
      <polygon points={poly([-CW, 0.4, -2.4], [-CW, 3.1, -1.9], [-CW, 3.1, -0.9], [-CW, 0.4, -1.5])} fill="#fff" opacity=".55" filter="url(#lg-soft)" />
      <polygon points={poly([CW, 0.5, -2.1], [CW, 3.2, -1.5], [CW, 3.2, -0.7], [CW, 0.5, -1.2])} fill="#fff" opacity=".45" filter="url(#lg-soft)" />
      <polygon points={poly([-CW, 0, ZN], [CW, 0, ZN], [CW, 0, 0], [-CW, 0, 0])} fill="url(#lg-c-floor)" />
      <path d={FLOOR_JOINTS} stroke="#a3a29d" strokeWidth=".9" opacity=".55" fill="none" />
      {/* reflejo de los tubos en el concreto pulido */}
      <g opacity=".28" filter="url(#lg-soft)">
        {[-1.25, 1.25].map((x) => <polygon key={x} points={strip(x, 0.07, 0, -4.6, -0.25)} fill="#fff" />)}
      </g>

      {/* tubos fluorescentes del pasillo */}
      <g className="lg-fluor">
        {TUBES.map(([x, a, b]) => (
          <g key={`${x}${a}`}>
            <polygon points={strip(x, 0.34, CH - 0.01, a - 0.25, b + 0.25)} fill="#fffbe8" opacity=".6" filter="url(#lg-glow-lg)" />
            <polygon points={strip(x, 0.13, CH - 0.005, a, b)} fill="#f6f5f0" stroke="#c6c4bd" strokeWidth=".6" />
            <polygon points={strip(x, 0.045, CH - 0.01, a + 0.05, b - 0.05)} fill="#fffef8" />
          </g>
        ))}
      </g>

      {/* ─── Pared del fondo con la entrada de la bahía ─── */}
      <path fillRule="evenodd" fill="url(#lg-c-end)"
        d={`M${END.x0} ${END.y0}H${END.x1}V${END.y1}H${END.x0}Z M${DOOR.x0} ${DOOR.y0}H${DOOR.x1}V${DOOR.y1}H${DOOR.x0}Z`} />
      <path d={TILES_END} stroke="#cdcac2" strokeWidth=".55" fill="none" />
      <polygon points={poly([1.78, 0.3, 0], [1.98, 3.2, 0], [2.28, 3.2, 0], [2.08, 0.3, 0])} fill="#fff" opacity=".6" filter="url(#lg-soft)" />
      <polygon points={poly([-2.52, 2.5, 0], [-2.46, 3.35, 0], [-2.28, 3.35, 0], [-2.34, 2.5, 0])} fill="#fff" opacity=".5" filter="url(#lg-soft)" />

      {/* ─── Interior de la bahía (azulejo iluminado y fosa) ─── */}
      <g clipPath="url(#lg-door)">
        <polygon points={poly([-W, H, 0], [W, H, 0], [W, H, D], [-W, H, D])} fill="url(#lg-ceil)" />
        <polygon points={poly([-W, 0, 0], [-W, H, 0], [-W, H, D], [-W, 0, D])} fill="url(#lg-wallL)" />
        <polygon points={poly([W, 0, 0], [W, H, 0], [W, H, D], [W, 0, D])} fill="url(#lg-wallR)" />
        <polygon points={poly([-W, 0, D], [W, 0, D], [W, H, D], [-W, H, D])} fill="url(#lg-back)" />
        <path d={TILES_BACK + TILES_BAY} stroke="#c2beb5" strokeWidth=".5" fill="none" />
        <polygon points={poly([-W, 0.4, 0.3], [-W, 2.3, 0.3], [-W, 2.3, 2.2], [-W, 0.4, 1.4])} fill="#fff" opacity=".35" />
        <polygon points={poly([W, 0.6, 1], [W, 2.4, 1.2], [W, 2.4, 3], [W, 0.6, 2.4])} fill="#fff" opacity=".25" />
        {/* logo en la pared del fondo, como el real */}
        <g transform={`translate(${CX} ${Y(1.78, D).toFixed(1)}) scale(.13)`} opacity=".9"><Shield fill="#a8915a" /></g>
        <text x={CX} y={Y(1.3, D)} textAnchor="middle" fontSize="4.6" letterSpacing="1.4" fill="#8f8a7d" style={DISPLAY}>LUXE GARAGE</text>
        {/* piso y fosa de rejillas de acero negro */}
        <polygon points={poly([-W, 0, 0], [W, 0, 0], [W, 0, D], [-W, 0, D])} fill="url(#lg-floor)" />
        <polygon points={poly([-FX, 0, FZ0], [FX, 0, FZ0], [FX, 0, FZ1], [-FX, 0, FZ1])} fill="#030303" />
        {PANELS.map((pn, i) => (
          <g key={i}>
            <polygon points={pn.poly} fill="url(#lg-steel)" />
            <path d={pn.bars} stroke="#3a3c40" strokeWidth=".45" fill="none" />
          </g>
        ))}
        <polygon points={poly([-0.82, 0, 0.3], [-0.68, 0, 0.3], [-0.68, 0, 5.6], [-0.82, 0, 5.6])} fill="#fff" opacity=".2" filter="url(#lg-glow-sm)" />
        <polygon points={poly([0.68, 0, 0.3], [0.82, 0, 0.3], [0.82, 0, 5.6], [0.68, 0, 5.6])} fill="#fff" opacity=".2" filter="url(#lg-glow-sm)" />
        <g className="lg-fluor">
          {[-0.75, 0.75].map((x) => (
            <g key={x}>
              <polygon points={strip(x, 0.12, H - 0.01, 0.3, 5.7)} fill="#fffbe8" opacity=".55" filter="url(#lg-glow-lg)" />
              <polygon points={strip(x, 0.03, H - 0.02, 0.4, 5.6)} fill="#fffef6" />
            </g>
          ))}
        </g>
        <rect x={DOOR.x0} y={DOOR.y0} width={DW} height={DH} fill="none" stroke="#3a352c" strokeWidth="8" opacity=".22" filter="url(#lg-blur)" />
      </g>

      {/* guías de la cortina y caja enrollable */}
      <rect x={RAIL_L.x} y={RAIL_L.y} width={RAIL_L.w} height={RAIL_L.h} fill="url(#lg-rail)" />
      <rect x={RAIL_R.x} y={RAIL_R.y} width={RAIL_R.w} height={RAIL_R.h} fill="url(#lg-rail)" />

      {/* cortina de acero (cerrado) */}
      <g clipPath="url(#lg-door)">
        <g className="lg-shutter" style={{ transform: `translateY(${shutterY}px)` }}>
          <rect x={DOOR.x0} y={DOOR.y0} width={DW} height={DH} fill="url(#lg-slats)" />
          <rect x={DOOR.x0} y={DOOR.y1 - 6} width={DW} height="6" fill="#3a3c3f" />
          <rect x={CX - 14} y={DOOR.y1 - 12} width="28" height="4" rx="2" fill="#2a2b2d" />
          <g transform={`translate(${CX} ${DOOR.y1 - 22})`}>
            <path d="M-4 -4 V-7 a4 4 0 0 1 8 0 V-4" fill="none" stroke="#c4c7cc" strokeWidth="1.6" />
            <rect x="-6" y="-4.5" width="12" height="9" rx="1.6" fill="#c9a54a" />
          </g>
        </g>
      </g>
      <rect x={HOUSING.x} y={HOUSING.y} width={HOUSING.w} height={HOUSING.h} rx="1.5" fill="url(#lg-box)" />
      <polygon points={poly([-1.74, 2.5, 0], [1.74, 2.5, 0], [1.74, 2.5, -0.16], [-1.74, 2.5, -0.16])} fill="#4b4d51" />

      {/* reflejos en el piso pulido: la entrada iluminada y el semáforo */}
      <rect x={DOOR.x0} y={DOOR.y1} width={DW} height={DH * 0.7} fill="url(#lg-refl)" opacity={closed ? 0.2 : 0.6} filter="url(#lg-soft)" className="lg-fade" />
      <rect x={SEM.x} y={2 * DOOR.y1 - SEM_BOTTOM} width={44 * SEM_K} height={124 * SEM_K * 0.6} rx="4" fill="#0a0a0b" opacity=".1" filter="url(#lg-soft)" />
      {sig && (
        <ellipse cx={SEM_CX} cy={2 * DOOR.y1 - LAMP_Y[status as "LIBRE" | "OCUPADO"]} rx="10" ry="24" fill={sig} opacity=".3" filter="url(#lg-blur)" />
      )}
      <path d={AO_FLOOR} stroke="#6f6c65" strokeWidth="4" opacity=".3" filter="url(#lg-soft)" fill="none" />
      <path d={AO_TOP} stroke="#8a867d" strokeWidth="3" opacity=".22" filter="url(#lg-soft)" fill="none" />

      {/* luz de color del estado que baña el pasillo */}
      <rect width="400" height="600" fill={sig ?? "#fff"} opacity={sig ? 0.05 : 0} className="lg-fade" />
      <ellipse cx={CX} cy={DOOR.y1 + 12} rx="230" ry="88" fill="url(#lg-spill)" opacity={sig ? 0.85 : 0} className="lg-fade" />
      <ellipse cx={SEM_CX} cy={(SEM.y + SEM_BOTTOM) / 2} rx="52" ry="78" fill="url(#lg-spill)" opacity={sig ? 0.75 : 0} className={sig ? "lg-fade lg-halo" : "lg-fade"} />

      {/* flechas de luz verde en el piso: “pasa” */}
      {CHEVRONS.map((c, i) => (
        <polygon key={i} points={c} fill={status === "LIBRE" ? SIG.LIBRE : "#b3b2ad"} stroke={status === "LIBRE" ? "none" : "#a2a19c"} strokeWidth=".6"
          className={status === "LIBRE" ? "lg-chevron" : ""} style={{ animationDelay: `${i * 0.22}s` }}
          filter={status === "LIBRE" ? "url(#lg-glow-sm)" : undefined} />
      ))}
      {/* franja LED del umbral */}
      <line x1={DOOR.x0} y1={DOOR.y1} x2={DOOR.x1} y2={DOOR.y1} stroke={sig ?? "#9d9c97"} strokeWidth="2.6" className="lg-fade" filter={sig ? "url(#lg-glow-sm)" : undefined} />

      {/* semáforo en la pared, del lado del conductor */}
      <rect x={SEM.x + 3} y={SEM.y + 4} width={44 * SEM_K} height={124 * SEM_K} rx="8" fill="#2a2620" opacity=".28" filter="url(#lg-soft)" />
      <g className="lg-power" transform={`translate(${SEM.x.toFixed(1)} ${SEM.y.toFixed(1)}) scale(${SEM_K})`}><Semaforo status={status} /></g>

      {/* marcador de neón tipo hockey colgando del techo: la hora y el estado */}
      <Scoreboard status={status} busy={busy} opens={opensShort} />

      {/* sombra del letrero sobre el azulejo */}
      <rect x={SIGN.x + 2} y={SIGN.y + 4} width={SIGN.w} height={SIGN.h} rx="3" fill="#2a2620" opacity=".3" filter="url(#lg-soft)" />

      <rect width="400" height="600" fill="url(#lg-vig)" />

      {/* de noche (cerrado): todo se oscurece en azul, los letreros siguen encendidos */}
      <rect width="400" height="600" fill="url(#lg-night)" className="lg-fade" opacity={closed ? 0.8 : 0} style={{ mixBlendMode: "multiply" }} />
      <ellipse cx={CX} cy={DOOR.y1 + 16} rx="175" ry="46" fill="url(#lg-amber)" className="lg-fade" opacity={closed ? 1 : 0} />
      <ellipse cx={CX} cy={SIGN.y + SIGN.h / 2} rx="150" ry="42" fill="url(#lg-amber)" className="lg-fade" opacity={closed ? 0.45 : 0} />

      {/* letrero LED ámbar de la cortina */}
      <g clipPath="url(#lg-door)">
        <g className="lg-shutter" style={{ transform: `translateY(${shutterY}px)` }}>
          <g transform={`translate(${CX} ${(DOOR.y0 + DOOR.y1) / 2 - 6})`}>
            <rect x="-82" y="-32" width="164" height="60" rx="6" fill="#070707" stroke="#2d2d30" strokeWidth="1.5" />
            <g filter="url(#lg-glow-sm)" className={closed ? "lg-neon" : ""}>
              <text x="0" y="1" textAnchor="middle" fontSize="23" fontWeight="800" letterSpacing="3.6" fill="#e8c25a" style={SANS}>CERRADO</text>
              {opensShort && <text x="0" y="19" textAnchor="middle" fontSize="9.5" fontWeight="700" letterSpacing="1.6" fill="#f6e2a0" style={SANS} {...opensFit}>{opensShort}</text>}
            </g>
            <rect x="-80" y="-30" width="160" height="56" rx="5" fill="url(#lg-led)" />
          </g>
        </g>
      </g>

      {/* letrero negro y oro sobre la entrada (iluminado) */}
      <g>
        <rect x={SIGN.x} y={SIGN.y} width={SIGN.w} height={SIGN.h} rx="2.5" fill="#060606" stroke="#3b331d" />
        <rect x={SIGN.x + 2.5} y={SIGN.y + 2.5} width={SIGN.w - 5} height={SIGN.h - 5} rx="1.5" fill="none" stroke="#c9a54a" strokeOpacity=".6" strokeWidth=".7" />
        <g transform={`translate(${(SIGN.x + 21).toFixed(1)} ${(SIGN.y + SIGN.h / 2).toFixed(1)}) scale(.2)`}><Shield fill="url(#lg-goldv)" /></g>
        <text x={SIGN.x + 37 + (SIGN.w - 43) / 2} y={SIGN.y + SIGN.h / 2 + 2.6} textAnchor="middle" fontSize="14.5" fontWeight="600" letterSpacing="1.6" fill="url(#lg-goldv)" style={DISPLAY}>LUXE GARAGE</text>
        <text x={SIGN.x + 37 + (SIGN.w - 43) / 2} y={SIGN.y + SIGN.h - 6.5} textAnchor="middle" fontSize="5.2" letterSpacing="1.5" fill="#c9ad62" style={SANS}>AUTO DETAILING &amp; CAR CARE</text>
        <rect x={SIGN.x + 1} y={SIGN.y + 1} width={SIGN.w - 2} height={SIGN.h * 0.42} rx="2" fill="#fff" opacity=".05" />
      </g>

      {/* el auto */}
      <g ref={carRef} style={{ opacity: 0 }}>
        <Accord brakeRef={brakeRef} revRef={revRef} foam={parked} />
      </g>
    </svg>
  );
}
