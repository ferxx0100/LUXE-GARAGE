"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import PayBrick from "./PayBrick";
import TimeGrid from "./TimeGrid";
import { addDays, hour12, KIND, longDay, MONTH, mxNow, wd, type DayHours, type Kind, type Vehicle } from "./fmt";

interface Props {
  price: number;
  washes: number;            // settings.subscriptionWashes
  validDays?: number;        // 30
  prices: { carro: number; camioneta: number };
  hours: DayHours[];
  today: string;
  mpPublicKey: string | null;
}
type Wash = { date: string; time: string };

// Igual que en el servidor (booking-core MEMBERSHIP_DAYS): solo jueves, viernes y sábado.
const MB_DAYS = [4, 5, 6];
const SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const field = "w-full min-h-14 rounded-2xl border-2 border-white/15 bg-white/[.06] px-4 py-3.5 text-lg text-white outline-none placeholder:text-white/45 focus:border-[#d36a8b]";
const digits = (s: string) => s.replace(/\D/g, "").length;

/** Semanas (jue–sáb) dentro de la vigencia. */
function weeks(from: string, to: string) {
  const out: string[][] = [];
  let d = from;
  while (wd(d) !== 4) d = addDays(d, -1); // jueves de esta semana
  for (; d <= to; d = addDays(d, 7)) {
    const w = MB_DAYS.map((_, i) => addDays(d, i));
    if (w[2] >= from) out.push(w);
  }
  return out;
}

export default function MembershipFlow({ price, washes: need, validDays = 30, prices, hours, today: serverToday, mpPublicKey }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [today, setToday] = useState(serverToday);
  const [kind, setKind] = useState<Kind>("completo");
  const [vehicle, setVehicle] = useState<Vehicle>("carro");
  const [picks, setPicks] = useState<Wash[]>([]);
  const [day, setDay] = useState<string | null>(null);            // día abierto para elegir hora
  const [starts, setStarts] = useState<string[] | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hold, setHold] = useState<{ id: string; code: string; amount: number; washes: Wash[]; until: number } | null>(null);
  const [left, setLeft] = useState(0);

  useEffect(() => { setToday(mxNow().date); }, [open]);
  const last = addDays(today, validDays);
  const wk = useMemo(() => weeks(today, last), [today, last]);
  const sorted = [...picks].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const dur = KIND[kind].min;

  // Pantalla completa: sin desplazar la página de atrás.
  useEffect(() => {
    if (!open) return;
    const y = window.scrollY, b = document.body.style;
    const prev = { position: b.position, top: b.top, left: b.left, right: b.right, width: b.width };
    Object.assign(b, { position: "fixed", top: `-${y}px`, left: "0", right: "0", width: "100%" });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) { if (day) setDay(null); else setOpen(false); } };
    window.addEventListener("keydown", esc);
    return () => { Object.assign(b, prev); window.scrollTo(0, y); window.removeEventListener("keydown", esc); };
  }, [open, busy, day]);

  // Cada paso empieza arriba.
  useEffect(() => { document.getElementById("mb-sheet")?.scrollTo({ top: 0 }); }, [step, hold]);

  // Horas libres del día tocado.
  useEffect(() => {
    if (!day) return;
    let alive = true;
    setStarts(null);
    fetch(`/api/booking/availability?date=${day}&kind=${kind}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setStarts(Array.isArray(d.starts) ? d.starts : []))
      .catch(() => alive && setStarts([]));
    return () => { alive = false; };
  }, [day, kind]);

  useEffect(() => {
    if (!hold) return;
    const f = () => setLeft(Math.max(0, Math.round((hold.until - Date.now()) / 1000)));
    f();
    const t = setInterval(f, 1000);
    return () => clearInterval(t);
  }, [hold]);

  function chooseKind(k: Kind) {
    if (k === kind) return;
    setKind(k);
    if (picks.length) { setPicks([]); setError("Cambiaste el tipo de lavado: vuelve a elegir tus días."); }
  }
  function tapDay(d: string) {
    setError("");
    if (!picks.some((p) => p.date === d) && picks.length >= need) { setError(`Ya elegiste tus ${need} días. Toca uno para quitarlo o cambiarlo.`); return; }
    setDay(d);
  }
  function pickTime(t: string) {
    if (!day) return;
    setPicks((p) => [...p.filter((x) => x.date !== day), { date: day, time: t }]);
    setDay(null);
  }
  const remove = (d: string) => { setPicks((p) => p.filter((x) => x.date !== d)); if (day === d) setDay(null); };

  const faltan = need - picks.length;
  const missing = name.trim().length < 2 ? "Escribe tu nombre" : digits(phone) < 10 ? "Escribe tu teléfono" : "";

  async function buy() {
    if (missing || busy || faltan > 0) return;
    setError(""); setBusy(true);
    try {
      const r = await fetch("/api/membership", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, vehicle, name, phone, washes: sorted }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "No pudimos apartar tus lavadas. Intenta de nuevo."); if (r.status === 409) setStep(2); return; }
      setHold({ id: d.id, code: d.code, amount: d.amount, washes: d.washes ?? sorted, until: Date.now() + 15 * 60 * 1000 });
    } catch { setError("Sin conexión. Intenta de nuevo."); }
    finally { setBusy(false); }
  }

  const TITLES = { 1: "¿Qué lavamos?", 2: `Elige tus ${need} días`, 3: "Tus datos" } as const;
  const next = step === 1 ? { label: "Siguiente", ok: true, go: () => setStep(2) }
    : step === 2 ? { label: faltan > 0 ? `Faltan ${faltan} día${faltan === 1 ? "" : "s"}` : "Siguiente", ok: faltan === 0, go: () => setStep(3) }
    : { label: busy ? "Apartando…" : missing || `Pagar $${price}`, ok: !missing && !busy && !!mpPublicKey, go: buy };

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setStep(1); setError(""); }} className="btn-water mt-6 min-h-14 w-full text-lg">Elegir mis días</button>

      {/* Portal a <body>: el desenfoque de la tarjeta de vidrio rompía "fixed" en iPhone */}
      {open && createPortal(
        <div className="mb-fade fixed inset-0 z-50 bg-black/70 md:grid md:place-items-center md:p-6" style={{ height: "100dvh" }} role="dialog" aria-modal="true" aria-label="Adquirir membresía">
          <div id="mb-sheet" className="relative flex h-full w-full flex-col overflow-y-auto overscroll-contain bg-[#0f1f3d] text-white [-webkit-overflow-scrolling:touch] md:h-auto md:max-h-[92dvh] md:max-w-lg md:rounded-[28px] md:border md:border-white/10">
            {/* Encabezado: dónde vas */}
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0f1f3d]/95 px-5 pb-3 pt-3 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white/60">{hold ? `Membresía · ${need} lavadas · $${price}` : `Paso ${step} de 3 · Membresía $${price}`}</p>
                  <p className="text-lg font-bold">{hold ? "Pago" : TITLES[step]}</p>
                </div>
                <button type="button" onClick={() => !busy && setOpen(false)} className="min-h-11 shrink-0 rounded-full border border-white/25 px-4 text-base font-bold">Cerrar</button>
              </div>
              {!hold && (
                <div className="mt-3 grid grid-cols-3 gap-1.5" aria-hidden>
                  {[1, 2, 3].map((n) => <span key={n} className={`h-1.5 rounded-full ${n <= step ? "bg-[#d36a8b]" : "bg-white/15"}`} />)}
                </div>
              )}
            </div>

            <div className="flex-1 px-5 pb-36 pt-5">
              {hold ? (
                <div className="space-y-5">
                  <div className="rounded-3xl border border-white/10 bg-white/[.06] p-5">
                    <p className="text-sm font-bold text-[#a9c4ff]">Tus {hold.washes.length} lavadas están apartadas</p>
                    <ul className="mt-3 space-y-1.5 text-base">
                      {hold.washes.map((w) => <li key={w.date}>✓ {longDay(w.date)} · <b className="tabular-nums">{hour12(w.time)}</b></li>)}
                    </ul>
                    <p className="mt-3 text-base text-white/75">Código <b className="text-white">{hold.code}</b></p>
                    <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4">
                      <p className="text-4xl font-extrabold tabular-nums">${hold.amount}</p>
                      <div className="text-right">
                        <p className="text-sm text-white/65">Tiempo para pagar</p>
                        <p className={`text-2xl font-extrabold tabular-nums ${left < 120 ? "text-red-300" : ""}`}>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</p>
                      </div>
                    </div>
                  </div>
                  {left === 0 || !mpPublicKey ? (
                    <button type="button" onClick={() => { setHold(null); setStep(2); }} className="btn-water min-h-14 w-full text-lg">Elegir otra vez</button>
                  ) : (
                    <PayBrick id="mp-brick-mb" publicKey={mpPublicKey} amount={hold.amount} payUrl={`/api/membership/${hold.id}/pay`} doneUrl={`/membresia/${hold.id}`} onError={setError} accent="#8e2348" />
                  )}
                  {error && <p role="alert" className="rounded-2xl bg-red-500/20 p-4 text-lg font-semibold text-red-100">{error}</p>}
                  <p className="text-center text-sm text-white/65">Pago seguro con Mercado Pago. Te llega el recibo a tu correo.</p>
                </div>
              ) : step === 1 ? (
                <div className="space-y-6">
                  <div className="grid gap-3">
                    {(["completo", "exterior"] as const).map((k) => (
                      <button key={k} type="button" aria-pressed={kind === k} onClick={() => chooseKind(k)}
                        className={`flex min-h-16 items-center gap-3.5 rounded-2xl border-2 px-4 py-3.5 text-left transition ${kind === k ? "border-[#d36a8b] bg-[#8e2348]/25" : "border-white/12 bg-white/[.04]"}`}>
                        <span className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${kind === k ? "border-[#d36a8b] bg-[#d36a8b]" : "border-white/35"}`}>
                          {kind === k && <span className="size-2.5 rounded-full bg-white" />}
                        </span>
                        <span><span className="block text-lg font-bold leading-tight">{KIND[k].title}</span><span className="block text-sm text-white/65">{KIND[k].min} min · {KIND[k].sub}</span></span>
                      </button>
                    ))}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/60">Tu vehículo</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-black/25 p-1.5" role="radiogroup" aria-label="Tipo de vehículo">
                      {(["carro", "camioneta"] as const).map((v) => (
                        <button type="button" role="radio" aria-checked={vehicle === v} key={v} onClick={() => setVehicle(v)}
                          className={`min-h-14 rounded-xl text-lg font-bold transition ${vehicle === v ? "bg-white text-[#0f1f3d]" : "text-white/80"}`}>
                          {v === "carro" ? "Carro" : "Camioneta"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="rounded-2xl bg-white/[.05] px-4 py-3 text-sm text-white/75">Una lavada suelta cuesta ${prices[vehicle]}. Con membresía pagas ${price} por las {need}.</p>
                </div>
              ) : step === 2 ? (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-base text-white/80">Solo <b className="text-white">jueves, viernes y sábado</b>. Toca un día y elige la hora.</p>
                    <p className="shrink-0 rounded-full bg-[#8e2348] px-3 py-1 text-base font-extrabold tabular-nums" aria-live="polite">{picks.length} de {need}</p>
                  </div>
                  <div className="mt-5 space-y-3">
                    {wk.map((w, i) => {
                      const newMonth = i === 0 || w[0].slice(5, 7) !== wk[i - 1][0].slice(5, 7);
                      return (
                        <div key={w[0]}>
                          {newMonth && <p className="mb-2 text-sm font-semibold capitalize text-white/55">{MONTH[Number(w[0].slice(5, 7)) - 1]}</p>}
                          <div className="grid grid-cols-3 gap-2">
                            {w.map((d) => {
                              const closed = !hours[wd(d)], out = d < today || d > last;
                              const pick = picks.find((p) => p.date === d);
                              return (
                                <button key={d} type="button" disabled={closed || out} onClick={() => tapDay(d)}
                                  aria-label={`${longDay(d)}${closed ? ", cerrado" : ""}${pick ? `, elegido a las ${hour12(pick.time)}` : ""}`}
                                  className={`flex h-[4.75rem] flex-col items-center justify-center rounded-2xl border-2 px-1 leading-tight transition disabled:opacity-25 ${pick ? "border-[#d36a8b] bg-[#8e2348]" : "border-white/12 bg-white/[.05] active:bg-white/15"}`}>
                                  <span className="text-sm font-semibold opacity-80">{SHORT[wd(d)]}</span>
                                  <span className="text-xl font-extrabold tabular-nums">{Number(d.slice(8))}</span>
                                  <span className="text-xs font-bold">{pick ? hour12(pick.time) : "\u00a0"}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {error && <p role="alert" className="mt-4 rounded-2xl bg-red-500/20 p-4 text-base font-semibold text-red-100">{error}</p>}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-2xl bg-white/[.05] p-4">
                    <p className="text-sm text-white/60">{KIND[kind].title} ({dur} min) · {vehicle === "carro" ? "Carro" : "Camioneta"}</p>
                    <ul className="mt-2 space-y-1.5">
                      {sorted.map((w) => (
                        <li key={w.date} className="flex justify-between gap-3 text-base">
                          <span>{SHORT[wd(w.date)]} {Number(w.date.slice(8))} de {MONTH[Number(w.date.slice(5, 7)) - 1]}</span>
                          <b className="shrink-0 tabular-nums">{hour12(w.time)}</b>
                        </li>
                      ))}
                    </ul>
                    <button type="button" onClick={() => setStep(2)} className="mt-3 text-sm font-semibold text-[#a9c4ff] underline underline-offset-4">Cambiar días</button>
                  </div>
                  <div className="grid gap-3">
                    <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" maxLength={80} aria-label="Nombre" />
                    <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (10 dígitos)" inputMode="tel" autoComplete="tel" maxLength={20} aria-label="Teléfono" />
                  </div>
                  <p className="text-sm text-white/60">Al pagar aceptas nuestro <a href="/privacidad" target="_blank" className="text-[#a9c4ff] underline">aviso de privacidad</a>. Usamos tus datos solo para tus lavadas.</p>
                  {!mpPublicKey && <p className="text-sm text-white/70">Pagos en línea en activación.</p>}
                  {error && <p role="alert" className="rounded-2xl bg-red-500/20 p-4 text-base font-semibold text-red-100">{error}</p>}
                </div>
              )}
            </div>

            {/* Abajo: atrás y siguiente, siempre en el mismo lugar */}
            {!hold && (
              <div className="sticky bottom-0 z-10 border-t border-white/10 bg-[#0f1f3d]/95 px-5 pt-3 backdrop-blur-md" style={{ paddingBottom: "max(.8rem, env(safe-area-inset-bottom))" }}>
                <div className="flex items-center gap-3">
                  {step > 1 && <button type="button" onClick={() => { setError(""); setStep((s) => (s - 1) as 1 | 2); }} className="min-h-14 shrink-0 rounded-full border border-white/25 px-5 text-base font-bold">Atrás</button>}
                  <button type="button" onClick={next.go} disabled={!next.ok} className="btn-water min-h-14 flex-1 text-lg disabled:opacity-45">{next.label}</button>
                </div>
              </div>
            )}
          </div>

          {day && !hold && (
            <div className="fixed inset-0 z-[60] flex items-end bg-black/50 md:items-center md:justify-center" onClick={() => setDay(null)}>
              <div className="mb-up max-h-[78dvh] w-full overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-white/15 bg-[#0f1f3d] p-5 text-white md:max-w-lg md:rounded-[28px]"
                style={{ paddingBottom: "max(1.2rem, env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Hora para el ${longDay(day)}`}>
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/25" />
                <p className="text-xl font-bold">{longDay(day)}</p>
                <p className="text-sm text-white/65">¿A qué hora? · lavado de {dur} min</p>
                <div className="mt-4">
                  {starts === null ? <p className="text-base text-white/70">Buscando horas…</p>
                    : starts.length === 0 ? <p className="text-base">Ese día ya no hay horas. Elige otro día.</p>
                    : <TimeGrid tone="water" starts={starts} value={picks.find((p) => p.date === day)?.time} onPick={pickTime} />}
                </div>
                <div className="mt-4 flex gap-2">
                  {picks.some((p) => p.date === day) && <button type="button" onClick={() => remove(day)} className="min-h-12 flex-1 rounded-xl border border-red-300/40 text-base font-bold text-red-200">Quitar este día</button>}
                  <button type="button" onClick={() => setDay(null)} className="min-h-12 flex-1 rounded-xl border border-white/25 text-base font-bold">Cerrar</button>
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
