"use client";
import { useEffect, useRef, useState } from "react";

type Seal = { status: string; seal: string; secondsLeft: number };
type Props = { endpoint: string; initial: Seal; tone?: "gold" | "cyan" };

const TZ = "America/Mexico_City";
const DAY = new Intl.DateTimeFormat("es-MX", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const HMS = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

/** "4:32:15 pm" (hora de Zamora, con segundos). */
function clock(d: Date) {
  const [h, m, s] = HMS.format(d).split(":").map(Number);
  const p = (n: number) => String(n).padStart(2, "0");
  return { hm: `${h % 12 === 0 ? 12 : h % 12}:${p(m)}`, s: p(s), ap: h < 12 ? "am" : "pm" };
}

// Emblema holográfico + reloj vivo + sello que cambia cada 30 s (lo calcula el servidor).
// Una captura de pantalla se delata sola: el reloj no avanza y el sello deja de coincidir.
export default function ReceiptSeal({ endpoint, initial, tone = "gold" }: Props) {
  const [seal, setSeal] = useState(initial);
  const [now, setNow] = useState<Date | null>(null);
  const until = useRef(0);

  useEffect(() => {
    until.current = Date.now() + initial.secondsLeft * 1000;
    let alive = true, timer: ReturnType<typeof setTimeout> | undefined;
    const pull = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(endpoint, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as Seal;
        if (!alive) return;
        until.current = Date.now() + d.secondsLeft * 1000;
        setSeal(d);
      } catch { /* sin red: el sello se apaga solo al vencer */ }
    };
    const loop = () => { pull(); timer = setTimeout(loop, 5000); };
    timer = setTimeout(loop, 5000);
    const tick = setInterval(() => {
      setNow(new Date());
      if (Date.now() > until.current && Date.now() - until.current < 1100) pull(); // cambió la ventana: pide el nuevo
    }, 1000);
    setNow(new Date());
    const vis = () => { if (!document.hidden) pull(); };
    document.addEventListener("visibilitychange", vis);
    return () => { alive = false; clearTimeout(timer); clearInterval(tick); document.removeEventListener("visibilitychange", vis); };
  }, [endpoint, initial.secondsLeft]);

  const fresh = now ? now.getTime() <= until.current + 1500 : true;
  const left = now ? Math.max(0, Math.min(30, (until.current - now.getTime()) / 1000)) : initial.secondsLeft;
  const c = now ? clock(now) : null;
  const accent = tone === "cyan" ? "#d4af37" : "#d4af37";
  const stamp = seal.status === "done" ? "USADO" : seal.status === "cancelled" ? "CANCELADO" : null;
  const R = 82, C = 2 * Math.PI * R;

  return (
    <div className="rs relative flex flex-col items-center px-6 pb-5 pt-7" style={{ ["--rs" as string]: accent }}>
      <style>{CSS}</style>
      <div className="relative h-[184px] w-[184px]">
        <div className="rs-foil absolute inset-0 rounded-full" />
        <div className="absolute inset-[7px] rounded-full bg-[#0b0b0c]" />
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 184 184" aria-hidden>
          <circle cx="92" cy="92" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="2" />
          <circle cx="92" cy="92" r={R} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - left / 30)} style={{ transition: "stroke-dashoffset 1s linear" }} />
        </svg>
        <div className="rs-emblem absolute inset-[26px] overflow-hidden rounded-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/emblem-128.png" alt="LUXE GARAGE" width="132" height="132" className="h-full w-full object-contain" />
          <span className="rs-shine" aria-hidden />
        </div>
        <span className="absolute bottom-[3px] left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-[#0b0b0c] px-3 py-0.5 font-mono text-[15px] font-bold tabular-nums tracking-[.32em] text-white/90"
          aria-label={fresh ? `Sello ${seal.seal}` : "Sello sin conexión"}>
          {fresh ? seal.seal : "– – –"}
        </span>
      </div>

      <p className="mt-5 font-display tabular-nums text-[2.6rem] font-semibold leading-none text-white" aria-live="off">
        {c ? <>{c.hm}<span className="rs-sec">:{c.s}</span> <span className="text-2xl text-white/70">{c.ap}</span></> : <span className="text-white/30">··:··:··</span>}
      </p>
      <p className="mt-2 text-base capitalize text-white/60">{now ? DAY.format(now) : " "}</p>

      {stamp && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-label={stamp}>
          <span className={`rs-stamp ${stamp === "USADO" ? "text-[#ff3b30] border-[#ff3b30]" : "text-white/80 border-white/80"} ${stamp === "USADO" ? "text-6xl" : "text-5xl"}`}>{stamp}</span>
        </div>
      )}
    </div>
  );
}

const CSS = `
.rs-foil{background:conic-gradient(from var(--rs-a,0deg),var(--rs),#fff6d0,#7dd3fc,#c4b5fd,#f9a8d4,#fde68a,var(--rs));animation:rs-spin 7s linear infinite;filter:saturate(1.15)}
@property --rs-a{syntax:"<angle>";inherits:false;initial-value:0deg}
@keyframes rs-spin{to{--rs-a:360deg}}
.rs-emblem{box-shadow:0 0 0 1px rgba(255,255,255,.08),0 0 28px color-mix(in oklab,var(--rs) 35%,transparent)}
.rs-shine{position:absolute;inset:-40%;background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.0) 42%,rgba(255,255,255,.55) 50%,rgba(125,211,252,.35) 54%,rgba(249,168,212,.25) 57%,transparent 62%);mix-blend-mode:screen;animation:rs-sweep 3.2s ease-in-out infinite}
@keyframes rs-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
.rs-sec{color:var(--rs)}
.rs-stamp{font-family:var(--font-display);font-weight:800;letter-spacing:.12em;padding:.15em .45em;border:5px solid;border-radius:14px;transform:rotate(-14deg);background:rgba(9,9,10,.55);mix-blend-mode:normal;box-shadow:inset 0 0 0 2px rgba(0,0,0,.25);-webkit-mask-image:radial-gradient(circle at 30% 40%,#000 60%,rgba(0,0,0,.75) 61%,#000 70%);animation:rs-in .35s ease-out}
@keyframes rs-in{from{transform:rotate(-14deg) scale(1.6);opacity:0}to{transform:rotate(-14deg) scale(1);opacity:1}}
@media (prefers-reduced-motion:reduce){.rs-foil{animation-duration:20s}.rs-shine{animation-duration:8s}}
`;
