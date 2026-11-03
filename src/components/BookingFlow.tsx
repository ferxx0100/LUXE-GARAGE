"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import PayBrick from "./PayBrick";
import TimeGrid from "./TimeGrid";
import { addDays, DAY, hour12, KIND, longDay, mxNow, range12, wd, type DayHours, type Kind, type Vehicle } from "./fmt";

interface Props {
  prices: { carro: number; camioneta: number; domicilio: number };
  hours: DayHours[];
  today: string;
  mpPublicKey: string | null;
}
type Avail = { starts: string[]; next: string | null; duration: number };
export type Prefill = { date: string; time: string; kind: Kind };

export function Card({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[.04] p-5 shadow-[0_20px_50px_rgba(0,0,0,.3)]">
      <h3 className="flex items-center gap-3 text-xl font-bold">
        <span className="grid size-9 place-items-center rounded-full bg-gold text-base font-extrabold text-ink">{n}</span>{title}
      </h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Choice({ on, onClick, title, sub, right }: { on: boolean; onClick: () => void; title: string; sub?: string; right?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`flex min-h-16 w-full items-center gap-3.5 rounded-2xl border-2 px-4 py-3.5 text-left transition active:scale-[.99] ${on ? "border-gold bg-gold/[.13]" : "border-white/12 bg-white/[.03]"}`}>
      <span className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${on ? "border-gold bg-gold" : "border-white/35"}`}>
        {on && <span className="size-2.5 rounded-full bg-ink" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold leading-tight">{title}</span>
        {sub && <span className="mt-0.5 block text-sm text-white/65">{sub}</span>}
      </span>
      {right && <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-gold">{right}</span>}
    </button>
  );
}

const input = "w-full min-h-14 rounded-2xl border-2 border-white/15 bg-black/30 px-4 py-3.5 text-lg outline-none placeholder:text-white/45 focus:border-gold";
const digits = (s: string) => s.replace(/\D/g, "").length;

export default function BookingFlow({ prices, hours, today: serverToday, mpPublicKey }: Props) {
  const [today, setToday] = useState(serverToday);
  useEffect(() => { setToday(mxNow().date); }, []);
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(today, i)), [today]);

  const [kind, setKind] = useState<Kind>("completo");
  const [vehicle, setVehicle] = useState<Vehicle>("carro");
  const [home, setHome] = useState(false);
  const [address, setAddress] = useState("");
  const [date, setDate] = useState(serverToday);
  const [otherDay, setOtherDay] = useState(false);
  const [avail, setAvail] = useState<Avail | null>(null);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hold, setHold] = useState<{ id: string; code: string; amount: number; duration: number; until: number } | null>(null);
  const [left, setLeft] = useState(0);
  const [reload, setReload] = useState(0);
  const pendingTime = useRef<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => { if (!otherDay) setDate(today); }, [today, otherDay]);

  // Desde el hero: "Apartar este lugar" fija servicio, día y hora.
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<Prefill>).detail;
      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !/^\d{2}:\d{2}$/.test(d.time)) return;
      setHold(null); setError("");
      if (d.kind === "completo" || d.kind === "exterior") setKind(d.kind);
      const t = mxNow().date;
      setOtherDay(d.date !== t);
      setDate(d.date);
      pendingTime.current = d.time;
      setReload((n) => n + 1);
    };
    window.addEventListener("lg:prefill", on);
    return () => window.removeEventListener("lg:prefill", on);
  }, []);

  // Horas libres del día para ese servicio, en vivo.
  useEffect(() => {
    let alive = true;
    setAvail(null); setTime("");
    fetch(`/api/booking/availability?date=${date}&kind=${kind}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const a: Avail = { starts: Array.isArray(d.starts) ? d.starts : [], next: d.next ?? null, duration: d.duration ?? KIND[kind].min };
        setAvail(a);
        const p = pendingTime.current;
        if (p) { pendingTime.current = null; if (a.starts.includes(p)) setTime(p); else setError("Ese lugar se acaba de ocupar. Elige otra hora."); }
      })
      .catch(() => alive && setAvail({ starts: [], next: null, duration: KIND[kind].min }));
    return () => { alive = false; };
  }, [date, kind, reload]);

  // Si hoy ya no hay horas, abrimos directo "Otro día".
  const noneToday = date === today && avail !== null && avail.starts.length === 0;
  useEffect(() => { if (noneToday && !otherDay && !pendingTime.current) setOtherDay(true); }, [noneToday, otherDay]);

  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.02 });
    io.observe(el);
    return () => io.disconnect();
  }, [hold]);

  useEffect(() => {
    if (!hold) return;
    const f = () => setLeft(Math.max(0, Math.round((hold.until - Date.now()) / 1000)));
    f();
    const t = setInterval(f, 1000);
    return () => clearInterval(t);
  }, [hold]);

  const dur = avail?.duration ?? KIND[kind].min;
  const total = prices[vehicle] + (home ? prices.domicilio : 0);
  const dayText = date === today ? "Hoy" : longDay(date);
  const when = time ? `${dayText} · ${range12(time, dur)}` : "";
  const missing = !time ? "Elige la hora" : name.trim().length < 2 ? "Escribe tu nombre" : digits(phone) < 10 ? "Escribe tu teléfono" : home && address.trim().length < 8 ? "Escribe tu dirección" : "";
  const ready = !missing;
  const first = avail ? avail.next ?? avail.starts[0] ?? null : null;

  async function reserve() {
    if (!ready || busy) return;
    setError(""); setBusy(true);
    try {
      const r = await fetch("/api/booking", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, time, vehicle, kind, place: home ? "domicilio" : "garage", address: home ? address : "", name, phone }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "No se pudo apartar. Intenta de nuevo."); if (r.status === 409) setReload((n) => n + 1); return; }
      setHold({ id: d.id, code: d.code, amount: d.amount, duration: d.duration ?? dur, until: Date.now() + 15 * 60 * 1000 });
      setTimeout(() => document.getElementById("pago")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch { setError("Sin conexión. Intenta de nuevo."); }
    finally { setBusy(false); }
  }

  /* ───────── Pantalla de pago ───────── */
  if (hold) {
    return (
      <div id="pago" className="scroll-mt-20">
        <div className="rounded-[28px] border border-gold/45 bg-gradient-to-b from-gold/[.14] to-transparent p-6">
          <p className="text-sm font-bold tracking-[.25em] text-gold">TU LUGAR ESTÁ APARTADO</p>
          <p className="font-display mt-3 text-[1.9rem] font-semibold leading-tight">{dayText}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{range12(time, hold.duration)}</p>
          <p className="mt-2 text-xl text-white/90">{KIND[kind].title} · {vehicle === "carro" ? "Carro" : "Camioneta"}{home ? " · A domicilio" : ""}</p>
          <p className="mt-1 text-lg text-white/75">Código <b className="text-gold">{hold.code}</b></p>
          <div className="mt-5 flex items-end justify-between">
            <p className="font-display text-gold-grad text-5xl font-semibold">${hold.amount}</p>
            <div className="text-right">
              <p className="text-sm text-white/70">Tiempo para pagar</p>
              <p className={`text-3xl font-extrabold tabular-nums ${left < 120 ? "text-stop" : "text-white"}`}>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</p>
            </div>
          </div>
        </div>
        {left === 0 || !mpPublicKey ? (
          <button onClick={() => { setHold(null); setReload((n) => n + 1); }} className="btn-gold mt-6 min-h-14 w-full text-xl">Elegir otra vez</button>
        ) : (
          <div className="mt-6"><PayBrick publicKey={mpPublicKey} amount={hold.amount} payUrl={`/api/booking/${hold.id}/pay`} doneUrl={`/reserva/${hold.id}`} onError={setError} /></div>
        )}
        {error && <p role="alert" className="mt-4 rounded-2xl bg-stop/15 p-4 text-xl font-semibold text-red-200">{error}</p>}
        <p className="mt-4 text-center text-base text-white/65">Pago seguro con Mercado Pago. Te llega el recibo a tu correo.</p>
      </div>
    );
  }

  /* ───────── Reserva en 3 pasos ───────── */
  return (
    <div ref={formRef} className="grid gap-8 pb-32">
      <Card n={1} title="¿Qué lavamos?">
        <div className="grid gap-3">
          {(["completo", "exterior"] as const).map((k) => (
            <Choice key={k} on={kind === k} onClick={() => setKind(k)} title={KIND[k].title} sub={`${KIND[k].min} min · ${KIND[k].sub}`} />
          ))}
        </div>
        <p className="mt-6 text-sm font-semibold text-white/60">Tu vehículo</p>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-black/30 p-1.5" role="radiogroup" aria-label="Tipo de vehículo">
          {(["carro", "camioneta"] as const).map((v) => (
            <button type="button" role="radio" aria-checked={vehicle === v} key={v} onClick={() => setVehicle(v)}
              className={`min-h-14 rounded-xl py-2.5 text-center transition ${vehicle === v ? "bg-white text-ink" : "text-white/80"}`}>
              <span className="block text-lg font-bold">{v === "carro" ? "Carro" : "Camioneta"}</span>
              <span className="block text-sm font-semibold opacity-75">${prices[v]}</span>
            </button>
          ))}
        </div>
        <label className="mt-6 flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 border-white/12 px-4 py-3.5">
          <span><span className="block text-lg font-bold">¿Vamos a tu casa?</span><span className="block text-sm text-white/65">+${prices.domicilio} por la visita</span></span>
          <input type="checkbox" checked={home} onChange={(e) => setHome(e.target.checked)} className="sr-only" />
          <span aria-hidden className={`relative h-9 w-16 shrink-0 rounded-full transition ${home ? "bg-gold" : "bg-white/20"}`}>
            <span className={`absolute top-1 size-7 rounded-full bg-white shadow transition-all ${home ? "left-8" : "left-1"}`} />
          </span>
        </label>
        {home && <textarea className={`${input} mt-3 min-h-24`} maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle, número, colonia y referencias" aria-label="Dirección" />}
      </Card>

      <Card n={2} title="¿Cuándo?">
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => { setOtherDay(false); setDate(today); }} aria-pressed={!otherDay}
            className={`min-h-16 rounded-2xl border-2 px-3 py-4 text-center transition ${!otherDay ? "border-gold bg-gold text-ink" : "border-white/15 bg-white/[.03]"}`}>
            <span className="block text-xl font-extrabold">Hoy</span>
            <span className="block text-sm font-semibold opacity-80">{DAY[wd(today)]} {Number(today.slice(8))}</span>
          </button>
          <button type="button" onClick={() => setOtherDay(true)} aria-pressed={otherDay}
            className={`min-h-16 rounded-2xl border-2 px-3 py-4 text-center transition ${otherDay ? "border-gold bg-gold text-ink" : "border-white/15 bg-white/[.03]"}`}>
            <span className="block text-xl font-extrabold">Otro día</span>
            <span className="block text-sm font-semibold opacity-80">{otherDay && date !== today ? `${DAY[wd(date)]} ${Number(date.slice(8))}` : "Elegir"}</span>
          </button>
        </div>

        {otherDay && (
          <div className="mt-4 grid max-h-[22rem] gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/25 p-2" role="listbox" aria-label="Elige el día">
            {days.slice(1).map((d) => {
              const open = !!hours[wd(d)], on = d === date;
              return (
                <button type="button" role="option" aria-selected={on} key={d} disabled={!open} onClick={() => setDate(d)}
                  className={`flex min-h-14 items-center justify-between rounded-xl px-4 py-3 text-left text-lg transition disabled:opacity-40 ${on ? "bg-gold font-bold text-ink" : "bg-white/[.04]"}`}>
                  <span>{d === addDays(today, 1) ? `Mañana, ${longDay(d).toLowerCase()}` : longDay(d)}</span>
                  <span className="text-base font-semibold">{open ? (on ? "✓" : "") : "Cerrado"}</span>
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-6 text-sm font-semibold text-white/60">{date === today ? "Horas libres de hoy" : `Horas libres del ${longDay(date).toLowerCase()}`}</p>
        {avail === null ? (
          <p className="mt-3 text-lg text-white/70">Buscando horas…</p>
        ) : !hours[wd(date)] ? (
          <p className="mt-3 rounded-2xl border border-white/10 p-4 text-lg text-white/85">Ese día está cerrado. Elige otro día.</p>
        ) : avail.starts.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-white/10 p-4 text-lg text-white/85">Ya no quedan horas este día. Toca <b>Otro día</b>.</p>
        ) : (
          <>
            <div className="mt-3"><TimeGrid starts={avail.starts} value={time} onPick={setTime} next={first} /></div>
            {first && !time && <p className="mt-2 text-sm text-white/65">● El punto marca el lugar más próximo.</p>}
            {time && (
              <p className="mt-4 rounded-2xl border border-gold/40 bg-gold/[.08] px-4 py-3 text-lg">
                Tu lavado: <b className="tabular-nums text-gold">{range12(time, dur)}</b>
              </p>
            )}
          </>
        )}
      </Card>

      <Card n={3} title="Tus datos">
        <div className="grid gap-3">
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" maxLength={80} aria-label="Nombre" />
          <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (10 dígitos)" inputMode="tel" autoComplete="tel" maxLength={20} aria-label="Teléfono" />
        </div>
        <p className="mt-4 text-sm text-white/60">Al pagar aceptas nuestro <a href="/privacidad" target="_blank" className="text-gold underline">aviso de privacidad</a>. Usamos tus datos solo para tu lavado.</p>
      </Card>

      {error && <p role="alert" className="rounded-2xl bg-stop/15 p-4 text-lg font-semibold text-red-200">{error}</p>}

      {/* Barra con el total, siempre a la mano en el celular */}
      <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 px-4 pt-3 backdrop-blur-md transition-transform duration-300 ${inView ? "translate-y-0" : "translate-y-full"}`}
        style={{ paddingBottom: "max(.8rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base text-white/80">{when || KIND[kind].title}</p>
            <p className="font-display text-[2rem] font-semibold leading-none text-gold">${total}</p>
          </div>
          {mpPublicKey ? (
            <button type="button" onClick={reserve} disabled={!ready || busy} className="btn-gold min-h-[3.75rem] min-w-[9.5rem] text-xl disabled:opacity-45">
              {busy ? "Apartando…" : ready ? `Pagar $${total}` : missing}
            </button>
          ) : (
            <span className="max-w-44 text-right text-base text-white/75">Pagos en línea en activación</span>
          )}
        </div>
      </div>
    </div>
  );
}
