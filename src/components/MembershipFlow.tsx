"use client";
import { useEffect, useMemo, useState } from "react";
import PayBrick from "./PayBrick";
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

const field = "w-full min-h-14 rounded-2xl border-2 border-cyan-200/25 bg-[#021424]/70 px-5 py-4 text-xl text-white outline-none placeholder:text-cyan-50/45 focus:border-[#67e8f9]";
const digits = (s: string) => s.replace(/\D/g, "").length;

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[26px] border border-cyan-200/15 bg-white/[.05] p-5">
      <h3 className="flex items-center gap-3 text-[1.35rem] font-bold">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#22d3ee] text-lg font-extrabold text-[#031b2e]">{n}</span>{title}
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

  useEffect(() => { setToday(mxNow().date); }, [open]);
  const last = addDays(today, validDays);
  const cal = useMemo(() => months(today, last), [today, last]);
  const sorted = [...picks].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const dur = KIND[kind].min;

  // Pantalla completa: sin desplazar la página de atrás.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [open, busy]);

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
    setTimeout(() => document.getElementById("mb-hours")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
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
      <button type="button" onClick={() => { setOpen(true); setError(""); }} className="btn-water mt-8 min-h-16 w-full text-xl">Adquirir membresía</button>

      {open && (
        <div className="fixed inset-0 z-50 bg-[#010b14]/70 backdrop-blur-sm md:grid md:place-items-center md:p-6" role="dialog" aria-modal="true" aria-label="Adquirir membresía">
          <div id="mb-sheet" className="sheet-in water-bg relative h-full w-full overflow-y-auto text-white md:h-auto md:max-h-[92vh] md:max-w-xl md:rounded-[32px] md:border md:border-cyan-200/20">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-cyan-200/15 bg-[#031b2e]/90 px-5 py-3 backdrop-blur-md">
              <div>
                <p className="text-xs font-bold tracking-[.3em] text-[#67e8f9]">MEMBRESÍA</p>
                <p className="font-display text-xl font-semibold">{need} lavadas · ${price}</p>
              </div>
              <button type="button" onClick={() => !busy && setOpen(false)} className="min-h-14 rounded-full border border-cyan-200/30 px-5 text-lg font-bold">Cerrar</button>
            </div>

            <div className="grid gap-4 p-4 pb-40">
              {hold ? (
                <>
                  <div className="rounded-[26px] border border-[#67e8f9]/40 bg-gradient-to-b from-[#22d3ee]/15 to-transparent p-5">
                    <p className="text-sm font-bold tracking-[.25em] text-[#67e8f9]">TUS {hold.washes.length} LAVADAS ESTÁN APARTADAS</p>
                    <ul className="mt-3 space-y-1.5 text-lg">
                      {hold.washes.map((w) => <li key={w.date}>✓ {longDay(w.date)} · <b className="tabular-nums">{hour12(w.time)}</b></li>)}
                    </ul>
                    <p className="mt-3 text-lg text-white/80">Código <b className="text-[#67e8f9]">{hold.code}</b></p>
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
                    <PayBrick id="mp-brick-mb" publicKey={mpPublicKey} amount={hold.amount} payUrl={`/api/membership/${hold.id}/pay`} doneUrl={`/membresia/${hold.id}`} onError={setError} accent="#22d3ee" />
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
                          className={`flex min-h-16 items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${kind === k ? "border-[#67e8f9] bg-[#22d3ee]/15" : "border-cyan-200/15 bg-white/[.03]"}`}>
                          <span><span className="block text-xl font-bold">{KIND[k].title}</span><span className="block text-base text-white/75">{KIND[k].sub}</span></span>
                          <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 font-bold text-[#67e8f9]">{KIND[k].min} min</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-black/25 p-1.5" role="radiogroup" aria-label="Tipo de vehículo">
                      {(["carro", "camioneta"] as const).map((v) => (
                        <button type="button" role="radio" aria-checked={vehicle === v} key={v} onClick={() => setVehicle(v)}
                          className={`min-h-14 rounded-xl text-xl font-bold transition ${vehicle === v ? "bg-white text-[#031b2e]" : "text-white/80"}`}>
                          {v === "carro" ? "Carro" : "Camioneta"}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-white/60">Precio normal por lavada: ${prices[vehicle]}. Con membresía, {need} por ${price}.</p>
                  </Step>

                  <Step n="2" title={`Elige tus ${need} días`}>
                    <div className="flex items-center justify-between">
                      <p className="text-lg text-white/85">Toca un día y luego la hora.</p>
                      <p className="rounded-full bg-[#22d3ee] px-3 py-1 text-lg font-extrabold tabular-nums text-[#031b2e]" aria-live="polite">{picks.length} de {need}</p>
                    </div>
                    {cal.map(({ y, m, cells }) => (
                      <div key={`${y}-${m}`} className="mt-4">
                        <p className="font-display text-xl font-semibold capitalize text-[#67e8f9]">{MONTH[m - 1]} {y}</p>
                        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-sm font-bold text-white/60">
                          {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i}>{d}</span>)}
                        </div>
                        <div className="mt-1 grid grid-cols-7 gap-1">
                          {cells.map((d, i) => {
                            if (!d) return <span key={`e${i}`} />;
                            const closed = !hours[wd(d)], out = d < today || d > last;
                            const pick = picks.find((p) => p.date === d), on = day === d;
                            return (
                              <button key={d} type="button" disabled={closed || out} onClick={() => tapDay(d)}
                                aria-label={`${longDay(d)}${closed ? ", cerrado" : ""}${pick ? `, elegido a las ${hour12(pick.time)}` : ""}`}
                                className={`flex aspect-square min-h-11 flex-col items-center justify-center rounded-xl text-lg font-bold transition disabled:opacity-25 ${pick ? "bg-[#22d3ee] text-[#031b2e] shadow-[0_0_18px_rgba(34,211,238,.55)]" : on ? "bg-white text-[#031b2e]" : "bg-white/[.07]"} ${d === today && !pick ? "ring-2 ring-[#67e8f9]/60" : ""}`}>
                                <span className="leading-none">{Number(d.slice(8))}</span>
                                {pick && <span className="mt-0.5 text-[10px] leading-none">{hour12(pick.time).replace(" ", "")}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {day && (
                      <div id="mb-hours" className="mt-5 rounded-2xl border border-[#67e8f9]/40 bg-[#021424]/80 p-4">
                        <p className="text-xl font-bold">{longDay(day)}</p>
                        <p className="text-base text-white/70">¿A qué hora? ({dur} min)</p>
                        {starts === null ? <p className="mt-3 text-lg text-white/70">Buscando horas…</p>
                          : starts.length === 0 ? <p className="mt-3 text-lg">Ese día ya no hay horas. Elige otro día.</p>
                          : (
                            <div className="mt-3 grid grid-cols-3 gap-2">
                              {starts.map((t) => {
                                const on = picks.some((p) => p.date === day && p.time === t);
                                return <button key={t} type="button" onClick={() => pickTime(t)} aria-pressed={on}
                                  className={`min-h-14 rounded-xl border-2 text-lg font-extrabold transition ${on ? "border-[#67e8f9] bg-[#22d3ee] text-[#031b2e]" : "border-cyan-200/20 bg-white/[.05]"}`}>{hour12(t)}</button>;
                              })}
                            </div>
                          )}
                        <div className="mt-3 flex gap-2">
                          {picks.some((p) => p.date === day) && <button type="button" onClick={() => remove(day)} className="min-h-14 flex-1 rounded-xl border border-red-300/40 text-lg font-bold text-red-200">Quitar este día</button>}
                          <button type="button" onClick={() => setDay(null)} className="min-h-14 flex-1 rounded-xl border border-cyan-200/30 text-lg font-bold">Listo</button>
                        </div>
                      </div>
                    )}

                    <div className="mt-5">
                      <p className="text-lg font-bold">Tus {need} lavadas</p>
                      {sorted.length === 0 ? <p className="mt-2 text-base text-white/65">Aún no eliges días.</p> : (
                        <ul className="mt-2 grid gap-2">
                          {sorted.map((w, i) => (
                            <li key={w.date} className="flex items-center gap-3 rounded-2xl bg-white/[.06] px-3 py-2.5">
                              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#22d3ee]/20 font-bold text-[#67e8f9]">{i + 1}</span>
                              <span className="min-w-0 flex-1 leading-tight">
                                <span className="block text-lg font-bold">{DAY[wd(w.date)]} {Number(w.date.slice(8))} de {MONTH[Number(w.date.slice(5, 7)) - 1]}</span>
                                <span className="block text-base tabular-nums text-white/80">{range12(w.time, dur)}</span>
                              </span>
                              <button type="button" onClick={() => tapDay(w.date)} className="min-h-12 rounded-xl px-3 text-base font-bold text-[#67e8f9]">Cambiar</button>
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
                    <p className="mt-3 text-base text-white/70">Al pagar aceptas nuestro <a href="/privacidad" target="_blank" className="text-[#67e8f9] underline">aviso de privacidad</a>. Usamos tus datos solo para tus lavadas.</p>
                  </Step>

                  {error && <p role="alert" className="rounded-2xl bg-red-500/20 p-4 text-xl font-semibold text-red-100">{error}</p>}
                </>
              )}
            </div>

            {!hold && (
              <div className="sticky bottom-0 z-10 border-t border-cyan-200/15 bg-[#031b2e]/95 px-4 pt-3 backdrop-blur-md" style={{ paddingBottom: "max(.8rem, env(safe-area-inset-bottom))" }}>
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
        </div>
      )}
    </>
  );
}
