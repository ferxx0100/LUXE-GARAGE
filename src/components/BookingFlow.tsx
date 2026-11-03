"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Vehicle = "carro" | "camioneta";
type Kind = "exterior" | "interior";
type Place = "garage" | "domicilio";
type Slot = { time: string; free: boolean };
interface Props {
  prices: { carro: number; camioneta: number; domicilio: number };
  openDays: number[];
  today: string;
  mpPublicKey: string | null;
}

declare global {
  interface Window { MercadoPago?: new (key: string, o?: { locale?: string }) => { bricks: () => { create: (t: string, el: string, s: unknown) => Promise<{ unmount: () => void }> } } }
}

const DAY = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const wd = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
const fmtDay = (d: string) => `${DAY[wd(d)]} ${Number(d.slice(8))} ${MONTH[Number(d.slice(5, 7)) - 1]}`;

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

function Tile({ on, onClick, title, sub, price, disabled }: { on: boolean; onClick: () => void; title: string; sub?: string; price?: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on}
      className={`relative flex min-h-[84px] flex-col justify-center rounded-2xl border-2 p-4 text-left transition active:scale-[.98] disabled:opacity-35 ${
        on ? "border-gold bg-gold/[.12] shadow-[0_0_0_4px_rgba(212,175,55,.12)]" : "border-white/12 bg-white/[.04] hover:border-white/30"}`}>
      <span className="text-lg font-bold leading-tight">{title}</span>
      {sub && <span className="mt-1 text-[15px] leading-snug text-white/75">{sub}</span>}
      {price && <span className="font-display mt-1.5 text-xl font-semibold text-gold">{price}</span>}
      {on && <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-gold text-sm font-bold text-ink">✓</span>}
    </button>
  );
}

const Step = ({ n, title, children }: { n: string; title: string; children: React.ReactNode }) => (
  <fieldset className="mt-10 first:mt-0">
    <legend className="mb-4 flex items-center gap-3 text-xl font-bold">
      <span className="font-display grid size-9 place-items-center rounded-full border border-gold/60 text-base text-gold">{n}</span>{title}
    </legend>
    {children}
  </fieldset>
);

const input = "w-full rounded-xl border-2 border-white/12 bg-white/[.04] px-4 py-3.5 text-lg outline-none placeholder:text-white/40 focus:border-gold";

export default function BookingFlow({ prices, openDays, today, mpPublicKey }: Props) {
  const [vehicle, setVehicle] = useState<Vehicle>("carro");
  const [kind, setKind] = useState<Kind>("exterior");
  const [place, setPlace] = useState<Place>("garage");
  const [address, setAddress] = useState("");
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i)), [today]);
  const [date, setDate] = useState(() => days.find((d) => openDays.includes(wd(d))) ?? today);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [plate, setPlate] = useState("");
  const [notes, setNotes] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hold, setHold] = useState<{ id: string; code: string; amount: number; email: string; until: number } | null>(null);
  const [left, setLeft] = useState(0);
  const brickRef = useRef<{ unmount: () => void } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [inView, setInView] = useState(false);

  // La barra del total solo aparece mientras el cliente está en la sección de reserva.
  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.02 });
    io.observe(el);
    return () => io.disconnect();
  }, [hold]);

  const total = prices[vehicle] + (place === "domicilio" ? prices.domicilio : 0);

  // Horarios del día elegido (en vivo: si alguien reserva, desaparece).
  useEffect(() => {
    let alive = true;
    setSlots(null); setTime("");
    fetch(`/api/booking/availability?date=${date}`).then((r) => r.json()).then((d) => alive && setSlots(d.slots ?? [])).catch(() => alive && setSlots([]));
    return () => { alive = false; };
  }, [date]);

  // Cuenta regresiva del apartado.
  useEffect(() => {
    if (!hold) return;
    const t = setInterval(() => setLeft(Math.max(0, Math.round((hold.until - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [hold]);

  const ready = time && name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10 && /\S+@\S+\.\S+/.test(email) && privacy && (place === "garage" || address.trim().length >= 8);

  async function reserve() {
    setError(""); setBusy(true);
    try {
      const r = await fetch("/api/booking", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, time, vehicle, kind, place, address, name, phone, email, plate, notes, privacy }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "No se pudo apartar"); if (r.status === 409) setDate((x) => x); return; }
      setHold({ ...d, until: Date.now() + 15 * 60 * 1000 });
      setTimeout(() => document.getElementById("pago")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch { setError("Sin conexión. Intenta de nuevo."); }
    finally { setBusy(false); }
  }

  // Formulario seguro de Mercado Pago (los datos de la tarjeta nunca tocan nuestro servidor).
  useEffect(() => {
    if (!hold || !mpPublicKey) return;
    let cancelled = false;
    (async () => {
      try {
        await loadMp();
        if (cancelled || !window.MercadoPago) return;
        const mp = new window.MercadoPago(mpPublicKey, { locale: "es-MX" });
        brickRef.current = await mp.bricks().create("cardPayment", "mp-brick", {
          initialization: { amount: hold.amount, payer: { email: hold.email } },
          customization: { visual: { style: { theme: "dark", customVariables: { baseColor: "#d4af37" } } }, paymentMethods: { maxInstallments: 1 } },
          callbacks: {
            onReady: () => {},
            onError: () => setError("Hubo un problema con el formulario de pago. Recarga la página."),
            onSubmit: (form: unknown) => new Promise<void>((resolve, reject) => {
              setError("");
              fetch(`/api/booking/${hold.id}/pay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) })
                .then(async (r) => {
                  const d = await r.json();
                  if (d.status === "approved" || d.status === "pending" || d.status === "conflict") { resolve(); window.location.href = `/reserva/${hold.id}`; }
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

  if (hold) {
    return (
      <div id="pago" className="scroll-mt-20">
        <div className="rounded-3xl border border-gold/40 bg-gold/[.07] p-5">
          <p className="text-sm font-semibold tracking-[.25em] text-gold">HORARIO APARTADO</p>
          <p className="font-display mt-2 text-3xl font-semibold">{fmtDay(date)} · {time}</p>
          <p className="mt-1 text-lg text-white/85">{vehicle === "carro" ? "Carro" : "Camioneta"} · {kind === "exterior" ? "Exterior" : "Interior"} · {place === "domicilio" ? "A domicilio" : "En el garage"}</p>
          <div className="mt-4 flex items-end justify-between">
            <p className="font-display text-gold-grad text-5xl font-semibold">${hold.amount}</p>
            <p className={`text-lg font-bold tabular-nums ${left < 120 ? "text-stop" : "text-white/85"}`}>{left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "Expiró"}</p>
          </div>
          <p className="mt-1 text-sm text-white/65">Paga antes de que termine el tiempo para asegurar tu lugar.</p>
        </div>
        {left === 0 ? (
          <button onClick={() => { setHold(null); setDate((d) => d); }} className="btn-gold mt-6 w-full text-lg">Elegir horario de nuevo</button>
        ) : (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[.03] p-3">
            <div id="mp-brick" />
          </div>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl bg-stop/15 p-4 text-lg font-semibold text-red-200">{error}</p>}
        <p className="mt-4 text-center text-sm text-white/55">Pago seguro con Mercado Pago. No guardamos los datos de tu tarjeta.</p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={(e) => { e.preventDefault(); if (ready) reserve(); }} className="pb-28">
      <Step n="I" title="Tu vehículo">
        <div className="grid grid-cols-2 gap-3">
          <Tile on={vehicle === "carro"} onClick={() => setVehicle("carro")} title="Carro" price={`$${prices.carro}`} />
          <Tile on={vehicle === "camioneta"} onClick={() => setVehicle("camioneta")} title="Camioneta" price={`$${prices.camioneta}`} />
        </div>
      </Step>

      <Step n="II" title="Servicio">
        <div className="grid grid-cols-2 gap-3">
          <Tile on={kind === "exterior"} onClick={() => setKind("exterior")} title="Exterior" sub="No necesitas bajarte del auto" />
          <Tile on={kind === "interior"} onClick={() => setKind("interior")} title="Interior" sub="Dejas el auto con nosotros" />
        </div>
      </Step>

      <Step n="III" title="¿Dónde?">
        <div className="grid grid-cols-2 gap-3">
          <Tile on={place === "garage"} onClick={() => setPlace("garage")} title="En el garage" sub="Las Palomas, Zamora" />
          <Tile on={place === "domicilio"} onClick={() => setPlace("domicilio")} title="A domicilio" sub="Vamos a tu casa" price={`+$${prices.domicilio}`} />
        </div>
        {place === "domicilio" && (
          <textarea className={`${input} mt-3 min-h-24`} maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="Calle, número, colonia y referencias" aria-label="Dirección para ir a domicilio" required />
        )}
      </Step>

      <Step n="IV" title="Día">
        <div className="-mx-5 flex snap-x gap-2.5 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
          {days.map((d, i) => {
            const open = openDays.includes(wd(d));
            const on = d === date;
            return (
              <button type="button" key={d} disabled={!open} onClick={() => setDate(d)} aria-pressed={on}
                className={`flex min-w-[76px] snap-start flex-col items-center rounded-2xl border-2 px-3 py-3 transition disabled:opacity-30 ${on ? "border-gold bg-gold text-ink" : "border-white/12 bg-white/[.04]"}`}>
                <span className="text-sm font-semibold">{i === 0 ? "Hoy" : i === 1 ? "Mañana" : DAY[wd(d)]}</span>
                <span className="font-display text-2xl font-semibold">{Number(d.slice(8))}</span>
                <span className="text-xs uppercase">{open ? MONTH[Number(d.slice(5, 7)) - 1] : "cerrado"}</span>
              </button>
            );
          })}
        </div>
      </Step>

      <Step n="V" title="Hora">
        {slots === null ? (
          <p className="text-lg text-white/70">Buscando horarios libres…</p>
        ) : slots.filter((s) => s.free).length === 0 ? (
          <p className="rounded-xl border border-white/10 p-4 text-lg text-white/80">No quedan horarios este día. Elige otro día.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {slots.map((s) => (
              <button type="button" key={s.time} disabled={!s.free} onClick={() => setTime(s.time)} aria-pressed={time === s.time}
                className={`rounded-xl border-2 py-3.5 text-lg font-bold tabular-nums transition ${
                  time === s.time ? "border-gold bg-gold text-ink" : s.free ? "border-white/15 bg-white/[.04] hover:border-gold/60" : "border-transparent bg-white/[.02] text-white/30 line-through"}`}>
                {s.time}
              </button>
            ))}
          </div>
        )}
      </Step>

      <Step n="VI" title="Tus datos">
        <div className="grid gap-3">
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" autoComplete="name" maxLength={80} required />
          <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (10 dígitos)" inputMode="tel" autoComplete="tel" maxLength={20} required />
          <input className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo (te llega el recibo)" type="email" autoComplete="email" maxLength={120} required />
          <input className={input} value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="Placas (opcional)" maxLength={12} />
          <textarea className={`${input} min-h-20`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (opcional)" maxLength={300} />
          <label className="flex items-start gap-3 text-[15px] leading-snug text-white/80">
            <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-1 size-5 accent-[#d4af37]" required />
            <span>Acepto el <a href="/privacidad" target="_blank" className="text-gold underline">aviso de privacidad</a>. Usamos tus datos solo para tu reserva.</span>
          </label>
        </div>
      </Step>

      {error && <p role="alert" className="mt-6 rounded-xl bg-stop/15 p-4 text-lg font-semibold text-red-200">{error}</p>}

      {/* Barra fija con el total: siempre a la vista en el celular */}
      <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 px-4 pt-3 backdrop-blur transition-transform duration-300 ${inView ? "translate-y-0" : "translate-y-full"}`} style={{ paddingBottom: "max(.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white/70">{time ? `${fmtDay(date)} · ${time}` : "Elige día y hora"}</p>
            <p className="font-display text-3xl font-semibold text-gold">${total}</p>
          </div>
          {mpPublicKey ? (
            <button type="submit" disabled={!ready || busy} className="btn-gold min-w-40 text-lg disabled:opacity-40">{busy ? "Apartando…" : "Pagar"}</button>
          ) : (
            <span className="max-w-44 text-right text-sm text-white/70">Pagos en línea en activación</span>
          )}
        </div>
      </div>
    </form>
  );
}
