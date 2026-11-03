"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import PayBrick from "./PayBrick";
import TimeGrid from "./TimeGrid";
import { addDays, DAY, hour12, KIND, longDay, MONTH, mxNow, range12, wd, type DayHours, type Kind, type Vehicle } from "./fmt";

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

const field = "w-full min-h-14 rounded-2xl border-2 border-[#a9c4ff]/25 bg-[#0b1630]/70 px-5 py-4 text-xl text-white outline-none placeholder:text-white/45 focus:border-[#d36a8b]";
const digits = (s: string) => s.replace(/\D/g, "").length;

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[26px] border border-[#a9c4ff]/15 bg-white/[.05] p-5">
      <h3 className="flex items-center gap-3 text-[1.35rem] font-bold">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#8e2348] text-lg font-extrabold text-[#ffffff]">{n}</span>{title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Meses (lun–dom) que cubren de "from" a "to". */
function months(from: string, to: string) {
  const out: { y: number; m: number; cells: (string | null)[] }[] = [];
  let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7));
  const ly = Number(to.slice(0, 4)), lm = Number(to.slice(5, 7));
  while (y < ly || (y === ly && m <= lm)) {
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const lead = (wd(first) + 6) % 7; // lunes = 0
    const len = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= len; d++) cells.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    out.push({ y, m, cells });
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

export default function MembershipFlow({ price, washes: need, validDays = 30, prices, hours, today: serverToday, mpPublicKey }: Props) {
  const [open, setOpen] = useState(false);
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
  const [mi, setMi] = useState(0); // mes visible del calendario

  useEffect(() => { setToday(mxNow().date); }, [open]);
  const last = addDays(today, validDays);
  const cal = useMemo(() => months(today, last), [today, last]);
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
    if (!picks.some((p) => p.date === d) && picks.length >= need) { setError(`Ya elegiste tus ${need} lavadas. Quita una para cambiarla.`); return; }
    setDay(d);
  }
  function pickTime(t: string) {
    if (!day) return;
    setPicks((p) => [...p.filter((x) => x.date !== day), { date: day, time: t }]);
    setDay(null);
  }
  const remove = (d: string) => { setPicks((p) => p.filter((x) => x.date !== d)); if (day === d) setDay(null); };

  const missing = picks.length < need ? `Elige ${need - picks.length} día${need - picks.length === 1 ? "" : "s"} más` : name.trim().length < 2 ? "Escribe tu nombre" : digits(phone) < 10 ? "Escribe tu teléfono" : "";

  async function buy() {
    if (missing || busy) return;
    setError(""); setBusy(true);
    try {
      const r = await fetch("/api/membership", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, vehicle, name, phone, washes: sorted }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "No pudimos apartar tus lavadas. Intenta de nuevo."); return; }
      setHold({ id: d.id, code: d.code, amount: d.amount, washes: d.washes ?? sorted, until: Date.now() + 15 * 60 * 1000 });
      document.getElementById("mb-sheet")?.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setError("Sin conexión. Intenta de nuevo."); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setError(""); }} className="btn-water mt-6 min-h-14 w-full text-lg">Elegir mis días</button>

      {/* Portal a <body>: el desenfoque de la tarjeta de vidrio rompía "fixed" en iPhone */}
      {open && createPortal(
        <div className="mb-fade fixed inset-0 z-50 bg-[#010b14]/75 md:grid md:place-items-center md:p-6" style={{ height: "100dvh" }} role="dialog" aria-modal="true" aria-label="Adquirir membresía">
          <div id="mb-sheet" className="water-bg relative h-full w-full overflow-y-auto overscroll-contain text-white [-webkit-overflow-scrolling:touch] md:h-auto md:max-h-[92dvh] md:max-w-xl md:rounded-[32px] md:border md:border-[#a9c4ff]/20">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#a9c4ff]/15 bg-[#0f1f3d]/90 px-5 py-3 backdrop-blur-md">
              <div>
                <p className="text-xs font-bold tracking-[.3em] text-[#a9c4ff]">MEMBRESÍA</p>
                <p className="font-display text-xl font-semibold">{need} lavadas · ${price}</p>
              </div>
              <button type="button" onClick={() => !busy && setOpen(false)} className="min-h-14 rounded-full border border-[#a9c4ff]/30 px-5 text-lg font-bold">Cerrar</button>
            </div>

            <div className="grid gap-4 p-4 pb-40">
              {hold ? (
                <>
                  <div className="rounded-[26px] border border-[#d36a8b]/40 bg-gradient-to-b from-[#8e2348]/15 to-transparent p-5">
                    <p className="text-sm font-bold tracking-[.25em] text-[#a9c4ff]">TUS {hold.washes.length} LAVADAS ESTÁN APARTADAS</p>
                    <ul className="mt-3 space-y-1.5 text-lg">
                      {hold.washes.map((w) => <li key={w.date}>✓ {longDay(w.date)} · <b className="tabular-nums">{hour12(w.time)}</b></li>)}
                    </ul>
                    <p className="mt-3 text-lg text-white/80">Código <b className="text-[#a9c4ff]">{hold.code}</b></p>
                    <div className="mt-4 flex items-end justify-between">
                      <p className="font-display text-5xl font-semibold">${hold.amount}</p>
                      <div className="text-right">
                        <p className="text-sm text-white/70">Tiempo para pagar</p>
                        <p className={`text-3xl font-extrabold tabular-nums ${left < 120 ? "text-red-300" : ""}`}>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</p>
                      </div>
                    </div>
                  </div>
                  {left === 0 || !mpPublicKey ? (
                    <button type="button" onClick={() => setHold(null)} className="btn-water min-h-14 w-full text-xl">Elegir otra vez</button>
                  ) : (
                    <PayBrick id="mp-brick-mb" publicKey={mpPublicKey} amount={hold.amount} payUrl={`/api/membership/${hold.id}/pay`} doneUrl={`/membresia/${hold.id}`} onError={setError} accent="#8e2348" />
                  )}
                  {error && <p role="alert" className="rounded-2xl bg-red-500/20 p-4 text-xl font-semibold text-red-100">{error}</p>}
                  <p className="text-center text-base text-white/70">Pago seguro con Mercado Pago. Te llega el recibo a tu correo.</p>
                </>
              ) : (
                <>
                  <Step n="1" title="¿Qué lavamos?">
                    <div className="grid gap-2.5">
                      {(["completo", "exterior"] as const).map((k) => (
                        <button key={k} type="button" aria-pressed={kind === k} onClick={() => chooseKind(k)}
                          className={`flex min-h-16 items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${kind === k ? "border-[#d36a8b] bg-[#8e2348]/15" : "border-[#a9c4ff]/15 bg-white/[.03]"}`}>
                          <span><span className="block text-xl font-bold">{KIND[k].title}</span><span className="block text-base text-white/75">{KIND[k].sub}</span></span>
                          <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 font-bold text-[#a9c4ff]">{KIND[k].min} min</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-black/25 p-1.5" role="radiogroup" aria-label="Tipo de vehículo">
                      {(["carro", "camioneta"] as const).map((v) => (
                        <button type="button" role="radio" aria-checked={vehicle === v} key={v} onClick={() => setVehicle(v)}
                          className={`min-h-14 rounded-xl text-xl font-bold transition ${vehicle === v ? "bg-white text-[#ffffff]" : "text-white/80"}`}>
                          {v === "carro" ? "Carro" : "Camioneta"}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-white/60">Precio normal por lavada: ${prices[vehicle]}. Con membresía, {need} por ${price}.</p>
                  </Step>

                  <Step n="2" title={`Elige tus ${need} días`}>
                    <div className="flex items-center justify-between">
                      <p className="text-lg text-white/85">Toca un día y luego la hora.</p>
                      <p className="shrink-0 whitespace-nowrap rounded-full bg-[#8e2348] px-3 py-1 text-lg font-extrabold tabular-nums text-[#ffffff]" aria-live="polite">{picks.length} de {need}</p>
                    </div>
                    {(() => {
                      const cur = cal[Math.min(mi, cal.length - 1)];
                      if (!cur) return null;
                      const { y, m, cells } = cur;
                      return (
                        <div className="mt-4">
                          <div className="flex items-center justify-between">
                            <button type="button" onClick={() => setMi((v) => Math.max(0, v - 1))} disabled={mi === 0} aria-label="Mes anterior" className="grid size-12 place-items-center rounded-full bg-white/10 text-2xl font-bold disabled:opacity-25">‹</button>
                            <p className="font-display text-xl font-semibold capitalize text-[#a9c4ff]">{MONTH[m - 1]} {y}</p>
                            <button type="button" onClick={() => setMi((v) => Math.min(cal.length - 1, v + 1))} disabled={mi >= cal.length - 1} aria-label="Mes siguiente" className="grid size-12 place-items-center rounded-full bg-white/10 text-2xl font-bold disabled:opacity-25">›</button>
                          </div>
                          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-sm font-bold text-white/60">
                            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i}>{d}</span>)}
                          </div>
                          <div className="mt-1 grid grid-cols-7 gap-1">
                            {cells.map((d, i) => {
                              if (!d) return <span key={`e${i}`} className="h-12" />;
                              const closed = !hours[wd(d)], out = d < today || d > last;
                              const pick = picks.find((p) => p.date === d);
                              return (
                                <button key={d} type="button" disabled={closed || out} onClick={() => tapDay(d)}
                                  aria-label={`${longDay(d)}${closed ? ", cerrado" : ""}${pick ? `, elegido a las ${hour12(pick.time)}` : ""}`}
                                  className={`flex h-12 flex-col items-center justify-center rounded-xl text-lg font-bold transition disabled:opacity-20 ${pick ? "bg-[#8e2348] text-[#ffffff] shadow-[0_0_14px_rgba(142,35,72,.5)]" : "bg-white/[.08] active:bg-white/20"} ${d === today && !pick ? "ring-2 ring-[#d36a8b]/60" : ""}`}>
                                  <span className="leading-none">{Number(d.slice(8))}</span>
                                  {pick && <span className="mt-0.5 text-[10px] font-extrabold leading-none">{hour12(pick.time).replace(" ", "")}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="mt-5">
                      <p className="text-lg font-bold">Tus {need} lavadas</p>
                      {sorted.length === 0 ? <p className="mt-2 text-base text-white/65">Aún no eliges días.</p> : (
                        <ul className="mt-2 grid gap-2">
                          {sorted.map((w, i) => (
                            <li key={w.date} className="flex items-center gap-3 rounded-2xl bg-white/[.06] px-3 py-2.5">
                              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#8e2348]/20 font-bold text-[#a9c4ff]">{i + 1}</span>
                              <span className="min-w-0 flex-1 leading-tight">
                                <span className="block text-lg font-bold">{DAY[wd(w.date)]} {Number(w.date.slice(8))} de {MONTH[Number(w.date.slice(5, 7)) - 1]}</span>
                                <span className="block text-base tabular-nums text-white/80">{range12(w.time, dur)}</span>
                              </span>
                              <button type="button" onClick={() => tapDay(w.date)} className="min-h-12 rounded-xl px-3 text-base font-bold text-[#a9c4ff]">Cambiar</button>
                              <button type="button" onClick={() => remove(w.date)} aria-label="Quitar" className="min-h-12 rounded-xl px-3 text-base font-bold text-red-200">Quitar</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Step>

                  <Step n="3" title="Tus datos">
                    <div className="grid gap-3">
                      <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" maxLength={80} aria-label="Nombre" />
                      <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (10 dígitos)" inputMode="tel" autoComplete="tel" maxLength={20} aria-label="Teléfono" />
                    </div>
                    <p className="mt-3 text-base text-white/70">Al pagar aceptas nuestro <a href="/privacidad" target="_blank" className="text-[#a9c4ff] underline">aviso de privacidad</a>. Usamos tus datos solo para tus lavadas.</p>
                  </Step>

                  {error && <p role="alert" className="rounded-2xl bg-red-500/20 p-4 text-xl font-semibold text-red-100">{error}</p>}
                </>
              )}
            </div>

            {!hold && (
              <div className="sticky bottom-0 z-10 border-t border-[#a9c4ff]/15 bg-[#0f1f3d]/95 px-4 pt-3 backdrop-blur-md" style={{ paddingBottom: "max(.8rem, env(safe-area-inset-bottom))" }}>
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base text-white/80">{picks.length} de {need} lavadas</p>
                    <p className="font-display text-[2rem] font-semibold leading-none">${price}</p>
                  </div>
                  {mpPublicKey ? (
                    <button type="button" onClick={buy} disabled={!!missing || busy} className="btn-water min-h-[3.75rem] min-w-[9.5rem] text-lg disabled:opacity-50">
                      {busy ? "Apartando…" : missing || `Pagar $${price}`}
                    </button>
                  ) : <span className="max-w-44 text-right text-base text-white/75">Pagos en línea en activación</span>}
                </div>
              </div>
            )}
          </div>

          {day && !hold && (
            <div className="fixed inset-0 z-[60] flex items-end bg-black/50" onClick={() => setDay(null)}>
              <div className="mb-up max-h-[78dvh] w-full overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-[#a9c4ff]/25 bg-[#0f1f3d] p-5 text-white md:mx-auto md:max-w-xl md:rounded-[28px]"
                style={{ paddingBottom: "max(1.2rem, env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Hora para el ${longDay(day)}`}>
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/25" />
                <p className="text-2xl font-bold">{longDay(day)}</p>
                <p className="text-base text-white/70">¿A qué hora? · lavado de {dur} min</p>
                <div className="mt-4">
                  {starts === null ? <p className="text-lg text-white/70">Buscando horas…</p>
                    : starts.length === 0 ? <p className="text-lg">Ese día ya no hay horas. Elige otro día.</p>
                    : <TimeGrid tone="water" starts={starts} value={picks.find((p) => p.date === day)?.time} onPick={pickTime} />}
                </div>
                <div className="mt-4 flex gap-2">
                  {picks.some((p) => p.date === day) && <button type="button" onClick={() => remove(day)} className="min-h-14 flex-1 rounded-xl border border-red-300/40 text-lg font-bold text-red-200">Quitar este día</button>}
                  <button type="button" onClick={() => setDay(null)} className="min-h-14 flex-1 rounded-xl border border-[#a9c4ff]/30 text-lg font-bold">Cerrar</button>
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
