// El cuarto real de LUXE GARAGE: azulejo blanco y fosa de rejillas de acero negro, en perspectiva.
// SVG vectorial (nítido en pantallas Retina) con dos encuadres: vertical (iPhone) y horizontal (computadora).
type V = [number, number, number];
interface Cam { W: number; H: number; F: number; ZC: number; CAM: number; HZ: number }

const RW = 1.7, RH = 2.9, RD = 8;          // medio ancho, alto y fondo del cuarto (m)
const FX = 1.0, FZ0 = 0.15, FZ1 = 7.6, ROWS = 7; // la fosa

function build(c: Cam) {
  const sc = (z: number) => c.F / (z + c.ZC);
  const P = ([x, y, z]: V) => `${(c.W / 2 + x * sc(z)).toFixed(1)},${(c.HZ + (c.CAM - y) * sc(z)).toFixed(1)}`;
  const poly = (...v: V[]) => v.map(P).join(" ");
  const seg = (a: V, b: V) => `M${P(a)}L${P(b)}`;
  const steps = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

  const tile = 0.24;
  const wallTiles = (s: number) => [
    ...steps(0, RD, Math.round(RD / tile)).map((z) => seg([s * RW, 0, z], [s * RW, RH, z])),
    ...steps(0, RH, Math.round(RH / tile)).map((y) => seg([s * RW, y, 0], [s * RW, y, RD])),
  ].join("");
  const backTiles = [
    ...steps(-RW, RW, Math.round((2 * RW) / tile)).map((x) => seg([x, 0, RD], [x, RH, RD])),
    ...steps(0, RH, Math.round(RH / tile)).map((y) => seg([-RW, y, RD], [RW, y, RD])),
  ].join("");

  const panels: { poly: string; bars: string }[] = [];
  for (const [xa, xb] of [[-FX + 0.06, -0.04], [0.04, FX - 0.06]]) {
    for (let r = 0; r < ROWS; r++) {
      const z0 = FZ0 + ((FZ1 - FZ0) / ROWS) * r + 0.06, z1 = FZ0 + ((FZ1 - FZ0) / ROWS) * (r + 1) - 0.06;
      const n = Math.round((xb - xa) / 0.05);
      panels.push({
        poly: poly([xa, 0, z0], [xb, 0, z0], [xb, 0, z1], [xa, 0, z1]),
        bars: [...steps(xa, xb, n).map((x) => seg([x, 0, z0], [x, 0, z1])), ...steps(z0, z1, 5).map((z) => seg([xa, 0, z], [xb, 0, z]))].join(""),
      });
    }
  }
  return {
    ceil: poly([-RW, RH, 0], [RW, RH, 0], [RW, RH, RD], [-RW, RH, RD]),
    left: poly([-RW, 0, 0], [-RW, RH, 0], [-RW, RH, RD], [-RW, 0, RD]),
    right: poly([RW, 0, 0], [RW, RH, 0], [RW, RH, RD], [RW, 0, RD]),
    back: poly([-RW, 0, RD], [RW, 0, RD], [RW, RH, RD], [-RW, RH, RD]),
    floor: poly([-RW, 0, 0], [RW, 0, 0], [RW, 0, RD], [-RW, 0, RD]),
    pit: poly([-FX, 0, FZ0], [FX, 0, FZ0], [FX, 0, FZ1], [-FX, 0, FZ1]),
    tiles: wallTiles(-1) + wallTiles(1) + backTiles,
    seams: [seg([-RW, 0, 0], [-RW, 0, RD]), seg([RW, 0, 0], [RW, 0, RD]), seg([-RW, RH, 0], [-RW, RH, RD]), seg([RW, RH, 0], [RW, RH, RD])].join(""),
    tubes: [-0.85, 0.85].map((x) => ({
      glow: poly([x - 0.16, RH - 0.01, 0.2], [x + 0.16, RH - 0.01, 0.2], [x + 0.16, RH - 0.01, RD - 0.3], [x - 0.16, RH - 0.01, RD - 0.3]),
      tube: poly([x - 0.035, RH - 0.02, 0.3], [x + 0.035, RH - 0.02, 0.3], [x + 0.035, RH - 0.02, RD - 0.4], [x - 0.035, RH - 0.02, RD - 0.4]),
      wet: poly([x - 0.1, 0.001, 0.2], [x + 0.1, 0.001, 0.2], [x + 0.1, 0.001, FZ1], [x - 0.1, 0.001, FZ1]),
    })),
    panels,
  };
}

function Room({ cam, id, className }: { cam: Cam; id: string; className: string }) {
  const g = build(cam);
  const u = (n: string) => `${id}-${n}`;
  return (
    <svg viewBox={`0 0 ${cam.W} ${cam.H}`} className={className} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={u("ceil")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9c7c1" /><stop offset="1" stopColor="#ecebe6" /></linearGradient>
        <linearGradient id={u("wl")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#d8d5ce" /><stop offset="1" stopColor="#f6f5f1" /></linearGradient>
        <linearGradient id={u("wr")} x1="1" y1="0" x2="0" y2="0"><stop offset="0" stopColor="#d8d5ce" /><stop offset="1" stopColor="#f6f5f1" /></linearGradient>
        <linearGradient id={u("floor")} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#8f8d88" /><stop offset="1" stopColor="#c4c2bc" /></linearGradient>
        <linearGradient id={u("steel")} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#151618" /><stop offset="1" stopColor="#26282b" /></linearGradient>
        <radialGradient id={u("vig")} cx=".5" cy=".45" r=".75"><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".28" /></radialGradient>
        <filter id={u("blur")} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id={u("soft")} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2" /></filter>
      </defs>
      <rect width={cam.W} height={cam.H} fill="#efeee9" />
      <polygon points={g.ceil} fill={`url(#${u("ceil")})`} />
      <polygon points={g.left} fill={`url(#${u("wl")})`} />
      <polygon points={g.right} fill={`url(#${u("wr")})`} />
      <polygon points={g.back} fill="#f7f6f2" />
      <path d={g.tiles} stroke="#c3bfb5" strokeWidth=".7" fill="none" />
      <polygon points={g.floor} fill={`url(#${u("floor")})`} />
      <polygon points={g.pit} fill="#050506" />
      {g.panels.map((p, i) => (
        <g key={i}><polygon points={p.poly} fill={`url(#${u("steel")})`} /><path d={p.bars} stroke="#3a3c40" strokeWidth=".6" fill="none" /></g>
      ))}
      <path d={g.seams} stroke="#000" strokeOpacity=".22" strokeWidth="6" filter={`url(#${u("soft")})`} />
      {g.tubes.map((t, i) => (
        <g key={i}>
          <polygon points={t.glow} fill="#fffbe9" opacity=".55" filter={`url(#${u("blur")})`} />
          <polygon points={t.tube} fill="#fffef8" />
          <polygon points={t.wet} fill="#fff" opacity=".13" filter={`url(#${u("soft")})`} />
        </g>
      ))}
      <rect width={cam.W} height={cam.H} fill={`url(#${u("vig")})`} />
    </svg>
  );
}

const MOBILE: Cam = { W: 400, H: 860, F: 380, ZC: 1.0, CAM: 1.55, HZ: 345 };
const DESKTOP: Cam = { W: 1200, H: 720, F: 800, ZC: 1.0, CAM: 1.55, HZ: 300 };

export default function TileRoom({ children, title }: { children: React.ReactNode; title: React.ReactNode }) {
  return (
    <section id="lugar" className="relative overflow-hidden bg-tile">
      <div className="relative mx-auto aspect-[400/860] w-full max-w-[640px] md:aspect-[1200/720] md:max-w-none">
        <Room cam={MOBILE} id="trm" className="absolute inset-0 h-full w-full md:hidden" />
        <Room cam={DESKTOP} id="trd" className="absolute inset-0 hidden h-full w-full md:block" />
        <div className="absolute inset-x-0 top-[4.5%] px-6 text-center md:inset-x-auto md:left-[6%] md:top-1/2 md:w-[30%] md:-translate-y-1/2 md:text-left">{title}</div>
        <div className="absolute left-1/2 top-[30%] w-[58%] -translate-x-1/2 md:left-auto md:right-[8%] md:top-[9%] md:w-[24%] md:translate-x-0">{children}</div>
      </div>
    </section>
  );
}
