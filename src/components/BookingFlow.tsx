"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Vehicle = "carro" | "camioneta";
type Kind = "completo" | "exterior";
type DayHours = { open: number; close: number } | null;
type Slot = { time: string; free: boolean };
interface Props {
  prices: { carro: number; camioneta: number; domicilio: number };
  hours: DayHours[];
  today: string;
  mpPublicKey: string | null;
}

declare global {
  interface Window { MercadoPago?: new (key: string, o?: { locale?: string }) => { bricks: () => { create: (t: string, el: string, s: unknown) => Promise<{ unmount: () => void }> } } }
}

const DAY = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTH = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const wd = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
const longDay = (d: string) => `${DAY[wd(d)]} ${Number(d.slice(8))} de ${MONTH[Number(d.slice(5, 7)) - 1]}`;
const hour12 = (t: string) => { const h = Number(t.slice(0, 2)); const n = h % 12 || 12; return `${n} ${h < 12 ? "am" : "pm"}`; };
const mxToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function loadMp(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://sdk.mercadopago.com/js/v2";
    s.onload = () => res();
    s.onerror = () => rej(new Error("sdk"));
    document.head.appendChild(s);
  });
}

function Card({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[.06] to-white/[.02] p-5 shadow-[0_20px_60px_rgba(0,0,0,.35)]">
      <h3 className="flex items-center gap-3 text-[1.45rem] font-bold">
        <span className="grid size-10 place-items-center rounded-full bg-gold text-lg font-extrabold text-ink">{n}</span>{title}
      </h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Choice({ on, onClick, title, sub, right }: { on: boolean; onClick: () => void; title: string; sub?: string; right?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left transition active:scale-[.99] ${on ? "border-gold bg-gold/[.13]" : "border-white/12 bg-white/[.03]"}`}>
      <span className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${on ? "border-gold bg-gold" : "border-white/35"}`}>
        {on && <span className="size-2.5 rounded-full bg-ink" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-bold leading-tight">{title}</span>
        {sub && <span className="mt-0.5 block text-base text-white/75">{sub}</span>}
      </span>
      {right && <span className="font-display text-xl font-semibold text-gold">{right}</span>}
    </button>
  );
}

const input = "w-full rounded-2xl border-2 border-white/15 bg-black/30 px-5 py-4 text-xl outline-none placeholder:text-white/45 focus:border-gold";

export default function BookingFlow({ prices, hours, today: serverToday, mpPublicKey }: Props) {
  const [today, setToday] = useState(serverToday);
  useEffect(() => { setToday(mxToday()); }, []);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i)), [today]);

  const [date, setDate] = useState(serverToday);
  const [otherDay, setOtherDay] = useState(false);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [time, setTime] = useState("");
  const [kind, setKind] = useState<Kind>("completo");
  const [vehicle, setVehicle] = useState<Vehicle>("carro");
  const [home, setHome] = useState(false);
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hold, setHold] = useState<{ id: string; code: string; amount: number; until: number } | null>(null);
  const [left, setLeft] = useState(0);
  const brickRef = useRef<{ unmount: () => void } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => { if (!otherDay) setDate(today); }, [today, otherDay]);

  // Horarios del día elegido, en vivo.
  useEffect(() => {
    let alive = true;
    setSlots(null); setTime("");
    fetch(`/api/booking/availability?date=${date}`).then((r) => r.json()).then((d) => alive && setSlots(d.slots ?? [])).catch(() => alive && setSlots([]));
    return () => { alive = false; };
  }, [date]);

  // Si hoy ya no hay horarios, abrimos directo "Otro día".
  const freeToday = date === today && slots !== null && !slots.some((s) => s.free);
  useEffect(() => { if (freeToday && !otherDay) setOtherDay(true); }, [freeToday, otherDay]);

  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.02 });
    io.observe(el);
    return () => io.disconnect();
  }, [hold]);

  useEffect(() => {
    if (!hold) return;
    const t = setInterval(() => setLeft(Math.max(0, Math.round((hold.until - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [hold]);

  const total = prices[vehicle] + (home ? prices.domicilio : 0);
  const kindText = kind === "completo" ? "Exterior e interior" : "Solo exterior";
  const when = time ? `${date === today ? "Hoy" : longDay(date)} · ${hour12(time)}` : "";
  const ready = !!time && name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10 && plate.trim().length >= 5 && (!home || address.trim().length >= 8);
  const missing = !time ? "Elige la hora" : name.trim().length < 2 ? "Escribe tu nombre" : phone.replace(/\D/g, "").length < 10 ? "Escribe tu teléfono" : plate.trim().length < 5 ? "Escribe tus placas" : home && address.trim().length < 8 ? "Escribe tu dirección" : "";

  async function reserve() {
    if (!ready || busy) return;
    setError(""); setBusy(true);
    try {
      const r = await fetch("/api/booking", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, time, vehicle, kind, place: home ? "domicilio" : "garage", address, name, phone, plate }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "No se pudo apartar"); if (r.status === 409) { setTime(""); setDate((x) => x); } return; }
      setHold({ id: d.id, code: d.code, amount: d.amount, until: Date.now() + 15 * 60 * 1000 });
      setTimeout(() => document.getElementById("pago")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch { setError("Sin conexión. Intenta de nuevo."); }
    finally { setBusy(false); }
  }

  // Formulario seguro de Mercado Pago: tarjeta y correo (para el recibo) los captura Mercado Pago.
  useEffect(() => {
    if (!hold || !mpPublicKey) return;
    let cancelled = false;
    (async () => {
      try {
        await loadMp();
        if (cancelled || !window.MercadoPago) return;
        const mp = new window.MercadoPago(mpPublicKey, { locale: "es-MX" });
        brickRef.current = await mp.bricks().create("cardPayment", "mp-brick", {
          initialization: { amount: hold.amount },
          customization: { visual: { style: { theme: "dark", customVariables: { baseColor: "#d4af37" } } }, paymentMethods: { maxInstallments: 1 } },
          callbacks: {
            onReady: () => {},
            onError: () => setError("Hubo un problema con el formulario de pago. Recarga la página."),
            onSubmit: (form: unknown) => new Promise<void>((resolve, reject) => {
              setError("");
              fetch(`/api/booking/${hold.id}/pay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) })
                .then(async (r) => {
                  const d = await r.json();
                  if (["approved", "pending", "conflict"].includes(d.status)) { resolve(); window.location.href = `/reserva/${hold.id}`; }
                  else { setError(d.error ?? "Pago rechazado"); reject(); }
                })
                .catch(() => { setError("Sin conexión. No se hizo ningún cargo."); reject(); });
            }),
          },
        });
      } catch { setError("No se pudo cargar el pago. Revisa tu conexión y recarga."); }
    })();
    return () => { cancelled = true; brickRef.current?.unmount(); brickRef.current = null; };
  }, [hold, mpPublicKey]);

  /* ───────── Pantalla de pago ───────── */
  if (hold) {
    return (
      <div id="pago" className="scroll-mt-20">
        <div className="rounded-[28px] border border-gold/45 bg-gradient-to-b from-gold/[.14] to-transparent p-6">
          <p className="text-sm font-bold tracking-[.25em] text-gold">TU HORARIO ESTÁ APARTADO</p>
          <p className="font-display mt-3 text-[2rem] font-semibold leading-tight">{when}</p>
          <p className="mt-2 text-xl text-white/90">{kindText} · {vehicle === "carro" ? "Carro" : "Camioneta"}{home ? " · A domicilio" : ""}</p>
          <p className="mt-1 text-lg text-white/75">Placas {plate.toUpperCase()} · Código <b className="text-gold">{hold.code}</b></p>
          <div className="mt-5 flex items-end justify-between">
            <p className="font-display text-gold-grad text-5xl font-semibold">${hold.amount}</p>
            <div className="text-right">
              <p className="text-sm text-white/70">Tiempo para pagar</p>
              <p className={`text-3xl font-extrabold tabular-nums ${left < 120 ? "text-stop" : "text-white"}`}>{left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "0:00"}</p>
            </div>
          </div>
        </div>
        {left === 0 && hold ? (
          <button onClick={() => setHold(null)} className="btn-gold mt-6 w-full text-xl">Elegir otra vez</button>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-white/[.03] p-3"><div id="mp-brick" /></div>
        )}
        {error && <p role="alert" className="mt-4 rounded-2xl bg-stop/15 p-4 text-xl font-semibold text-red-200">{error}</p>}
        <p className="mt-4 text-center text-base text-white/65">Pago seguro con Mercado Pago. Te llega el recibo a tu correo.</p>
      </div>
    );
  }

  /* ───────── Reserva en 3 pasos ───────── */
  return (
    <div ref={formRef} className="grid gap-5 pb-32">
      <Card n={1} title="¿Cuándo?">
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => { setOtherDay(false); setDate(today); }} aria-pressed={!otherDay}
            className={`rounded-2xl border-2 px-3 py-4 text-center transition ${!otherDay ? "border-gold bg-gold text-ink" : "border-white/15 bg-white/[.03]"}`}>
            <span className="block text-2xl font-extrabold">Hoy</span>
            <span className="block text-base font-semibold opacity-80">{DAY[wd(today)]} {Number(today.slice(8))}</span>
          </button>
          <button type="button" onClick={() => setOtherDay(true)} aria-pressed={otherDay}
            className={`rounded-2xl border-2 px-3 py-4 text-center transition ${otherDay ? "border-gold bg-gold text-ink" : "border-white/15 bg-white/[.03]"}`}>
            <span className="block text-2xl font-extrabold">Otro día</span>
            <span className="block text-base font-semibold opacity-80">{otherDay && date !== today ? `${DAY[wd(date)]} ${Number(date.slice(8))}` : "Elegir"}</span>
          </button>
        </div>

        {otherDay && (
          <div className="mt-4 grid max-h-[22rem] gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/25 p-2" role="listbox" aria-label="Elige el día">
            {days.slice(1).map((d) => {
              const open = !!hours[wd(d)], on = d === date;
              return (
                <button type="button" role="option" aria-selected={on} key={d} disabled={!open} onClick={() => setDate(d)}
                  className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-left text-xl transition disabled:opacity-35 ${on ? "bg-gold font-bold text-ink" : "bg-white/[.04]"}`}>
                  <span>{d === addDays(today, 1) ? `Mañana, ${DAY[wd(d)].toLowerCase()} ${Number(d.slice(8))}` : longDay(d)}</span>
                  <span className="text-base">{open ? (on ? "✓" : "") : "Cerrado"}</span>
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-5 text-lg font-semibold text-white/85">{date === today ? "Horarios de hoy" : `Horarios del ${longDay(date).toLowerCase()}`}</p>
        {slots === null ? (
          <p className="mt-3 text-xl text-white/70">Buscando horarios…</p>
        ) : !hours[wd(date)] ? (
          <p className="mt-3 rounded-2xl border border-white/10 p-4 text-xl text-white/85">Ese día está cerrado. Elige otro día.</p>
        ) : !slots.some((s) => s.free) ? (
          <p className="mt-3 rounded-2xl border border-white/10 p-4 text-xl text-white/85">Ya no quedan horarios este día. Toca <b>Otro día</b>.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {slots.map((s) => (
              <button type="button" key={s.time} disabled={!s.free} onClick={() => setTime(s.time)} aria-pressed={time === s.time}
                className={`rounded-2xl border-2 py-4 text-center transition ${time === s.time ? "border-gold bg-gold text-ink" : s.free ? "border-white/15 bg-white/[.04]" : "border-transparent bg-white/[.02] text-white/35"}`}>
                <span className="block text-2xl font-extrabold">{hour12(s.time)}</span>
                {!s.free && <span className="block text-sm font-semibold">Ocupado</span>}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card n={2} title="¿Qué lavamos?">
        <div className="grid gap-3">
          <Choice on={kind === "completo"} onClick={() => setKind("completo")} title="Exterior e interior" sub="Dejas tu auto con nosotros" />
          <Choice on={kind === "exterior"} onClick={() => setKind("exterior")} title="Solo exterior" sub="No necesitas bajarte" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-black/30 p-1.5" role="radiogroup" aria-label="Tipo de vehículo">
          {(["carro", "camioneta"] as const).map((v) => (
            <button type="button" role="radio" aria-checked={vehicle === v} key={v} onClick={() => setVehicle(v)}
              className={`rounded-xl py-3.5 text-center transition ${vehicle === v ? "bg-white text-ink" : "text-white/80"}`}>
              <span className="block text-xl font-bold">{v === "carro" ? "Carro" : "Camioneta"}</span>
              <span className="block text-base font-semibold opacity-75">${prices[v]}</span>
            </button>
          ))}
        </div>
        <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 border-white/12 px-4 py-4">
          <span><span className="block text-xl font-bold">¿Vamos a tu casa?</span><span className="block text-base text-white/75">+${prices.domicilio} por la visita</span></span>
          <input type="checkbox" checked={home} onChange={(e) => setHome(e.target.checked)} className="peer sr-only" />
          <span aria-hidden className={`relative h-9 w-16 shrink-0 rounded-full transition ${home ? "bg-gold" : "bg-white/20"}`}>
            <span className={`absolute top-1 size-7 rounded-full bg-white shadow transition-all ${home ? "left-8" : "left-1"}`} />
          </span>
        </label>
        {home && <textarea className={`${input} mt-3 min-h-24`} maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle, número, colonia y referencias" aria-label="Dirección" />}
      </Card>

      <Card n={3} title="Tus datos">
        <div className="grid gap-3">
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" maxLength={80} aria-label="Nombre" />
          <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (WhatsApp)" inputMode="tel" autoComplete="tel" maxLength={20} aria-label="Teléfono" />
          <input className={`${input} uppercase tracking-widest`} value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="Placas" autoCapitalize="characters" maxLength={12} aria-label="Placas" />
        </div>
        <p className="mt-4 text-base text-white/65">Al pagar aceptas nuestro <a href="/privacidad" target="_blank" className="text-gold underline">aviso de privacidad</a>. Usamos tus datos solo para tu lavado.</p>
      </Card>

      {error && <p role="alert" className="rounded-2xl bg-stop/15 p-4 text-xl font-semibold text-red-200">{error}</p>}

      {/* Barra con el total, siempre a la mano en el celular */}
      <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 px-4 pt-3 backdrop-blur-md transition-transform duration-300 ${inView ? "translate-y-0" : "translate-y-full"}`}
        style={{ paddingBottom: "max(.8rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base text-white/80">{when || "Elige la hora"}</p>
            <p className="font-display text-[2rem] font-semibold leading-none text-gold">${total}</p>
          </div>
          {mpPublicKey ? (
            <button type="button" onClick={reserve} disabled={!ready || busy} className="btn-gold min-h-[3.75rem] min-w-[9.5rem] text-xl disabled:opacity-45">
              {busy ? "Apartando…" : ready ? "Pagar" : missing}
            </button>
          ) : (
            <span className="max-w-44 text-right text-base text-white/75">Pagos en línea en activación</span>
          )}
        </div>
      </div>
    </div>
  );
}
