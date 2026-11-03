"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import PayBrick from "./PayBrick";
import { addDays, hour12, KIND, longDay, mxNow, wd, type DayHours } from "./fmt";

interface Props {
  price: number;
  washes: number;            // settings.membershipWashes (4)
  validDays?: number;        // 30
  hours: DayHours[];
  today: string;
  mpPublicKey: string | null;
}
type Wash = { date: string; time: string };
type Step = "fechas" | "datos" | "pago";

// La membresía siempre es lavado completo (exterior e interior): turnos de 30 min.
const DUR = KIND.completo.min;
const SHORT_DAY = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const SHORT_MONTH = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTH_NAME = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const short = (d: string) => `${SHORT_DAY[wd(d)]} ${Number(d.slice(8))}`;
const digits = (s: string) => s.replace(/\D/g, "").length;
const field = "w-full min-h-16 rounded-2xl border-2 border-cyan-200/25 bg-[#021424]/80 px-5 text-lg text-white outline-none placeholder:text-cyan-50/45 focus:border-[#67e8f9]";

/** Semanas completas (lunes a domingo) que cubren de "from" a "to". */
function weeks(from: string, to: string): string[][] {
  let d = addDays(from, -((wd(from) + 6) % 7));
  const out: string[][] = [];
  while (d <= to) {
    const w: string[] = [];
    for (let i = 0; i < 7; i++) { w.push(d); d = addDays(d, 1); }
    out.push(w);
  }
  return out;
}

/**
 * Membresía en 3 pantallas que no se mueven: (1) fechas y turnos, (2) nombre y teléfono, (3) pago.
 * Arriba siempre se ven las 4 lavadas; abajo, un solo botón. Se abre sobre toda la pantalla (portal al body).
 */
export default function MembershipFlow({ price, washes: need, validDays = 30, hours, today: serverToday, mpPublicKey }: Props) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState(serverToday);
  const [step, setStep] = useState<Step>("fechas");
  const [picks, setPicks] = useState<(Wash | null)[]>(() => Array(need).fill(null));
  const [slot, setSlot] = useState(0);                        // lavada que se está eligiendo
  const [day, setDay] = useState<string | null>(null);        // día tocado: se ven sus turnos
  const [starts, setStarts] = useState<string[] | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hold, setHold] = useState<{ id: string; code: string; amount: number; until: number } | null>(null);
  const [left, setLeft] = useState(0);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (open) setToday(mxNow().date); }, [open]);
  const last = addDays(today, validDays);
  const cal = useMemo(() => weeks(today, last), [today, last]);
  const chosen = picks.filter((p): p is Wash => !!p);
  const complete = chosen.length === need;
  const sorted = [...chosen].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const months = [...new Set([today, last].map((d) => MONTH_NAME[Number(d.slice(5, 7)) - 1]))].join(" – ");

  // Pantalla completa: la página de atrás no se desplaza; Esc cierra.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [open, busy]);

  // Turnos libres del día tocado (lavado completo, 30 min).
  useEffect(() => {
    if (!day) return;
    let alive = true;
    setStarts(null);
    fetch(`/api/booking/availability?date=${day}&kind=completo`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setStarts(Array.isArray(d.starts) ? d.starts : []))
      .catch(() => alive && setStarts([]));
    return () => { alive = false; };
  }, [day]);

  useEffect(() => {
    if (!hold) return;
    const f = () => setLeft(Math.max(0, Math.round((hold.until - Date.now()) / 1000)));
    f();
    const t = setInterval(f, 1000);
    return () => clearInterval(t);
  }, [hold]);

  function pickTime(t: string) {
    if (!day) return;
    const next = picks.map((p, i) => (i === slot ? { date: day, time: t } : p));
    setPicks(next);
    setDay(null);
    const empty = next.findIndex((p) => !p);
    if (empty >= 0) setSlot(empty);
  }
  function tapSlot(i: number) {
    if (hold) return;
    setError(""); setSlot(i); setDay(null); setStep("fechas");
  }
  function clearSlot() {
    setPicks((p) => p.map((x, i) => (i === slot ? null : x)));
    setDay(null);
  }

  const missing = name.trim().length < 2 ? "Escribe tu nombre" : digits(phone) < 10 ? "Escribe tu teléfono" : "";

  async function buy() {
    if (!complete || missing || busy) return;
    setError(""); setBusy(true);
    try {
      const r = await fetch("/api/membership", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, phone, washes: sorted }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? "No pudimos apartar tus lavadas. Intenta de nuevo.");
        if (r.status === 409) setStep("fechas"); // una hora se ocupó: a cambiarla
        return;
      }
      setHold({ id: d.id, code: d.code, amount: d.amount, until: Date.now() + 15 * 60 * 1000 });
      setStep("pago");
    } catch { setError("Sin conexión. Intenta de nuevo."); }
    finally { setBusy(false); }
  }

  const back = step === "datos" ? () => { setStep("fechas"); setError(""); } : step === "fechas" && day ? () => setDay(null) : null;

  const sheet = (
    <div className="fixed inset-0 z-[70] bg-[#010b14]/75 backdrop-blur-sm md:grid md:place-items-center md:p-6" role="dialog" aria-modal="true" aria-label="Membresía">
      <div className="sheet-in water-bg relative flex h-full w-full flex-col overflow-hidden text-white md:h-[min(92vh,54rem)] md:max-w-lg md:rounded-[32px] md:border md:border-cyan-200/20">

        {/* Encabezado: qué es, cuánto cuesta, regresar y cerrar */}
        <header className="flex shrink-0 items-center gap-2 border-b border-cyan-200/15 bg-[#031b2e]/90 px-3 py-2.5" style={{ paddingTop: "max(.6rem, env(safe-area-inset-top))" }}>
          <button type="button" onClick={back ?? undefined} disabled={!back} aria-label="Regresar"
            className={`grid size-12 shrink-0 place-items-center rounded-full text-2xl ${back ? "bg-white/10" : "opacity-0"}`}>‹</button>
          <div className="min-w-0 flex-1 text-center leading-tight">
            <p className="font-display text-xl font-medium tracking-[.02em]">Membresía</p>
            <p className="text-sm text-cyan-50/75"><span className="num">${price}</span> · {need} lavadas completas</p>
          </div>
          <button type="button" onClick={() => !busy && setOpen(false)} aria-label="Cerrar" className="grid size-12 shrink-0 place-items-center rounded-full bg-white/10 text-xl">✕</button>
        </header>

        {/* Las lavadas incluidas: siempre visibles, en el mismo lugar */}
        <div className="grid shrink-0 grid-cols-4 gap-2 px-3 pb-3 pt-3" role="list" aria-label="Tus lavadas">
          {picks.map((p, i) => {
            const on = step === "fechas" && i === slot && !hold;
            return (
              <button key={i} type="button" role="listitem" onClick={() => tapSlot(i)} disabled={!!hold}
                aria-label={`Lavada ${i + 1}: ${p ? `${longDay(p.date)}, ${hour12(p.time)}` : "sin elegir"}`}
                className={`flex h-[4.6rem] flex-col items-center justify-center rounded-2xl border-2 px-1 leading-tight transition ${on ? "border-[#67e8f9] bg-[#22d3ee]/20" : p ? "border-[#22d3ee]/50 bg-[#22d3ee]/10" : "border-dashed border-cyan-200/30 bg-white/[.03]"}`}>
                <span className={`num grid size-5 place-items-center rounded-full text-[11px] font-semibold ${p ? "bg-[#22d3ee] text-[#031b2e]" : "bg-white/15"}`}>{p ? "✓" : i + 1}</span>
                {p ? (
                  <>
                    <span className="mt-1 text-[15px] font-semibold">{short(p.date)}</span>
                    <span className="num text-[13px] text-cyan-50/80">{hour12(p.time)}</span>
                  </>
                ) : <span className="mt-1.5 text-[13px] text-cyan-50/70">Lavada {i + 1}</span>}
              </button>
            );
          })}
        </div>

        {/* Contenido: cambia en su lugar, sin saltos */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
          {error && <p role="alert" className="mb-3 rounded-2xl bg-red-500/20 p-4 text-base font-medium text-red-100">{error}</p>}

          {step === "fechas" && !day && (
            <>
              <p className="text-center text-lg font-semibold">
                {complete ? "¡Listo! Ya elegiste tus lavadas." : <>Lavada {slot + 1}: <span className="text-[#67e8f9]">elige el día</span></>}
              </p>
              <p className={`mt-0.5 text-center text-sm text-cyan-50/60 ${complete ? "" : "capitalize"}`}>{complete ? "Toca una arriba para cambiarla" : months}</p>
              <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-white/55">
                {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i}>{d}</span>)}
              </div>
              <div className="mt-1.5 grid grid-cols-7 gap-1.5">
                {cal.flat().map((d) => {
                  if (d < today || d > last) return <span key={d} />;
                  const closed = !hours[wd(d)];
                  const owner = picks.findIndex((p) => p?.date === d);
                  const mine = owner === slot, taken = owner >= 0 && !mine;
                  const first = Number(d.slice(8)) === 1 || d === today;
                  return (
                    <button key={d} type="button" disabled={closed || taken} onClick={() => { setError(""); setDay(d); }}
                      aria-label={`${longDay(d)}${closed ? ", cerrado" : taken ? `, ya es tu lavada ${owner + 1}` : ""}`}
                      className={`num relative flex aspect-square min-h-12 flex-col items-center justify-center rounded-xl text-[17px] font-medium transition active:scale-95 ${
                        owner >= 0 ? "bg-[#22d3ee] font-semibold text-[#031b2e]" : closed ? "text-white/25" : "bg-white/[.08]"
                      } ${mine ? "ring-2 ring-white" : ""} ${d === today && owner < 0 ? "ring-2 ring-[#67e8f9]/70" : ""}`}>
                      {first && <span className="absolute top-0.5 text-[9px] font-semibold uppercase opacity-70">{d === today ? "hoy" : SHORT_MONTH[Number(d.slice(5, 7)) - 1]}</span>}
                      <span className="leading-none">{Number(d.slice(8))}</span>
                      {owner >= 0 && <span className="absolute bottom-0.5 text-[9px] font-semibold">#{owner + 1}</span>}
                    </button>
                  );
                })}
              </div>
              {picks[slot] && (
                <button type="button" onClick={clearSlot} className="mx-auto mt-4 block min-h-12 rounded-full px-5 text-base font-semibold text-red-200">Quitar lavada {slot + 1}</button>
              )}
            </>
          )}

          {step === "fechas" && day && (
            <>
              <p className="text-center text-lg font-semibold">Lavada {slot + 1}: <span className="text-[#67e8f9]">elige la hora</span></p>
              <p className="mt-0.5 text-center text-sm text-cyan-50/70">{longDay(day)} · {DUR} min</p>
              {starts === null ? <p className="mt-8 text-center text-base text-white/65">Buscando turnos…</p>
                : starts.length === 0 ? (
                  <div className="mt-6 text-center">
                    <p className="text-lg">Ese día ya no hay turnos.</p>
                    <button type="button" onClick={() => setDay(null)} className="btn-water mt-4 min-h-14 px-8 text-base">Elegir otro día</button>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-3 gap-2.5">
                    {starts.map((t, i) => {
                      const on = picks[slot]?.date === day && picks[slot]?.time === t;
                      return (
                        <button key={t} type="button" onClick={() => pickTime(t)} aria-pressed={on}
                          className={`num relative min-h-14 rounded-2xl border-2 text-lg font-semibold transition active:scale-95 ${on ? "border-white bg-[#22d3ee] text-[#031b2e]" : i === 0 ? "border-[#67e8f9]/70 bg-[#22d3ee]/10" : "border-cyan-200/20 bg-white/[.05]"}`}>
                          {i === 0 && <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[.14em] ${on ? "bg-[#031b2e] text-[#67e8f9]" : "bg-[#22d3ee] text-[#031b2e]"}`}>Próximo</span>}
                          {hour12(t)}
                        </button>
                      );
                    })}
                  </div>
                )}
            </>
          )}

          {step === "datos" && (
            <div className="grid gap-3">
              <p className="text-center text-lg font-semibold">¿A nombre de quién?</p>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" enterKeyHint="next" maxLength={80} aria-label="Nombre" />
              <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (10 dígitos)" inputMode="tel" autoComplete="tel" enterKeyHint="done" maxLength={20} aria-label="Teléfono" />
              <p className="mt-1 text-center text-sm text-cyan-50/70">Va a tu nombre: trae el auto que quieras.</p>
              <p className="text-center text-xs text-white/55">Al pagar aceptas nuestro <a href="/privacidad" target="_blank" className="text-[#67e8f9] underline">aviso de privacidad</a>.</p>
            </div>
          )}

          {step === "pago" && hold && (
            <div className="grid gap-4">
              <div className="flex items-center justify-between rounded-2xl border border-[#67e8f9]/35 bg-[#22d3ee]/10 px-4 py-3">
                <div>
                  <p className="text-sm text-cyan-50/75">Tus {need} lavadas están apartadas</p>
                  <p className="num text-3xl font-light">${hold.amount}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-cyan-50/65">Tiempo para pagar</p>
                  <p className={`num text-2xl font-semibold ${left < 120 ? "text-red-300" : ""}`}>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</p>
                </div>
              </div>
              {left === 0 || !mpPublicKey ? (
                <button type="button" onClick={() => { setHold(null); setStep("fechas"); }} className="btn-water min-h-16 w-full text-lg">Elegir otra vez</button>
              ) : (
                <PayBrick id="mp-brick-mb" publicKey={mpPublicKey} amount={hold.amount} payUrl={`/api/membership/${hold.id}/pay`} doneUrl={`/membresia/${hold.id}`} onError={setError} accent="#22d3ee" />
              )}
              <p className="text-center text-sm text-white/65">Pago seguro con Mercado Pago. Tu ticket llega a tu correo.</p>
            </div>
          )}
        </div>

        {/* Un solo botón, siempre en el mismo lugar */}
        {step !== "pago" && (
          <footer className="shrink-0 border-t border-cyan-200/15 bg-[#031b2e]/95 px-4 pt-3" style={{ paddingBottom: "max(.8rem, env(safe-area-inset-bottom))" }}>
            {step === "fechas" ? (
              <button type="button" disabled={!complete} onClick={() => { setStep("datos"); setDay(null); setError(""); }}
                className="btn-water min-h-16 w-full text-lg disabled:opacity-45">
                {complete ? "Continuar" : `Elige ${need - chosen.length} fecha${need - chosen.length === 1 ? "" : "s"} más`}
              </button>
            ) : mpPublicKey ? (
              <button type="button" onClick={buy} disabled={!!missing || busy} className="btn-water min-h-16 w-full text-lg disabled:opacity-45">
                {busy ? "Apartando…" : missing || `Pagar $${price}`}
              </button>
            ) : (
              <p className="py-4 text-center text-base text-white/75">Los pagos en línea se están activando.</p>
            )}
          </footer>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setError(""); }} className="btn-water mt-7 min-h-16 w-full text-lg">Adquirir membresía</button>
      {mounted && open && createPortal(sheet, document.body)}
    </>
  );
}
