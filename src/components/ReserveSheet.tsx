"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MpButton } from "./PayBrick";
import SlotPicker from "./SlotPicker";
import { DAY, durText, MONTH, SERVICE_DUR, SIZE_TAG, serviceLabel, toMin, wd, VEHICLES, vehicleLabel, type DayHours, type Service, type Vehicle } from "./fmt";

export type ReserveDetail = { date?: string; time?: string; service?: Service; vehicle?: Vehicle };
/** Abre la ventana de apartar desde cualquier botón: window.dispatchEvent(new CustomEvent("lg:reserve", { detail })) */
export const openReserve = (detail: ReserveDetail = {}) => window.dispatchEvent(new CustomEvent("lg:reserve", { detail }));

const field = "w-full min-h-16 rounded-2xl border-2 border-white/15 bg-black/30 px-5 text-lg text-white outline-none placeholder:text-white/40 focus:border-gold";
const pad = (n: number) => String(n).padStart(2, "0");
const range = (t: string, dur: number) => { const a = toMin(t), f = (x: number) => `${Math.floor(x / 60) % 12 || 12}:${pad(x % 60)}`; return `${f(a)}–${f(a + dur)}`; };
const dayText = (d: string) => `${DAY[wd(d)]} ${Number(d.slice(8))} de ${MONTH[Number(d.slice(5, 7)) - 1]}`;

/**
 * Apartar, igual para todos: (1) tamaño (carro 50 min, camioneta 1 h, SUV o pick up 1:40) → (2) día y hora que alcance
 * → (3) "Soy socio" o "Lavado sencillo" → (4) pagar en Mercado Pago. Profundo y detallado (fichas de abajo) no pasan por "socio".
 * Los socios terminan en su cuenta (/socio) con el turno ya elegido.
 */
export default function ReserveSheet({ hours, prices, mpPublicKey }: { hours: DayHours[]; prices: Record<Service, Record<Vehicle, number>>; mpPublicKey: string | null }) {
  const [service, setService] = useState<Service>("sencillo");
  // Si llegó desde el semáforo u "Otro día u hora" (sin lavado elegido), puede escoger cuál.
  const [askService, setAskService] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<{ date: string; time: string } | null>(null);
  const [step, setStep] = useState<"vehicle" | "pick" | "who" | "socio" | "single" | "pay">("vehicle");
  const [vehicle, setVehicle] = useState<Vehicle>("carro");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nip, setNip] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hold, setHold] = useState<{ id: string; amount: number; until: number } | null>(null);
  const [left, setLeft] = useState(0);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<ReserveDetail>).detail ?? {};
      setService(d.service ?? "sencillo"); setAskService(!d.service);
      const ok = d.date && d.time && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && /^\d{2}:\d{2}$/.test(d.time);
      setSlot(ok ? { date: d.date!, time: d.time! } : null);
      // Si ya eligió tamaño en el menú, no se vuelve a preguntar: directo a día y hora.
      // Desde el letrero (hora ya elegida, sin lavado): primero "Soy socio" o "Pagar un lavado".
      if (ok && !d.service) setStep("who");
      else if (d.vehicle && !ok) { setVehicle(d.vehicle); setStep("pick"); } else setStep("vehicle");
      setError(""); setHold(null); setOpen(true);
    };
    window.addEventListener("lg:reserve", on);
    return () => window.removeEventListener("lg:reserve", on);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [open, busy]);

  useEffect(() => {
    if (!hold) return;
    const f = () => setLeft(Math.max(0, Math.round((hold.until - Date.now()) / 1000)));
    f();
    const t = setInterval(f, 1000);
    return () => clearInterval(t);
  }, [hold]);

  const missing = name.trim().length < 2 ? "Escribe tu nombre" : phone.replace(/\D/g, "").length < 10 ? "Escribe tu celular" : "";

  async function reserve() {
    if (!slot || missing || busy) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/booking", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: slot.date, time: slot.time, vehicle, service, kind: "completo", place: "garage", address: "", name, phone }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "No se pudo apartar. Intenta de nuevo."); if (r.status === 409) { setStep("pick"); setSlot(null); } return; }
      setHold({ id: d.id, amount: d.amount, until: Date.now() + 15 * 60 * 1000 }); setStep("pay");
    } catch { setError("Sin conexión. Intenta de nuevo."); }
    finally { setBusy(false); }
  }

  // Elegir tamaño: si ya venía una hora (del letrero), se revisa que alcance para ese lavado y tamaño.
  async function fits(v: Vehicle, svc: Service) {
    if (!slot) return false;
    try {
      const r = await fetch(`/api/booking/availability?date=${slot.date}&kind=completo&vehicle=${v}&service=${svc}`, { cache: "no-store" });
      const d = await r.json();
      return Array.isArray(d.starts) && d.starts.includes(slot.time);
    } catch { return false; }
  }
  async function chooseVehicle(v: Vehicle) {
    setVehicle(v); setError("");
    if (!slot) { setStep("pick"); return; }
    setBusy(true);
    const ok = await fits(v, service);
    setBusy(false);
    if (ok) { setStep(service === "sencillo" && !askService ? "who" : "single"); return; }
    if (askService) { setError(`${serviceLabel(service)} para ${vehicleLabel(v).toLowerCase()} dura ${durText(SERVICE_DUR[service][v])} y a esa hora no alcanza. Escoge otro lavado.`); return; }
    setError(`A esa hora no alcanza para ${vehicleLabel(v).toLowerCase()} (${durText(SERVICE_DUR[service][v])}). Elige otra.`);
    setSlot(null); setStep("pick");
  }

  // Socio: celular + NIP y aparta ese turno con una de sus lavadas (mismas rutas y bloqueo por intentos que /socio).
  const nipMissing = phone.replace(/\D/g, "").length < 10 ? "Escribe tu celular" : nip.length < 4 ? "Escribe tu NIP de 4 números" : "";
  async function memberBook() {
    if (!slot || nipMissing || busy) return;
    setBusy(true); setError("");
    try {
      const l = await fetch("/api/socio/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, nip }) });
      const ld = await l.json().catch(() => ({}));
      if (!l.ok) { setError(ld.error ?? "Celular o NIP incorrecto."); return; }
      const b = await fetch("/api/socio/book", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: slot.date, time: slot.time }) });
      const bd = await b.json().catch(() => ({}));
      if (!b.ok) { setError(bd.error ?? "No pudimos apartar. Intenta de nuevo."); return; }
      window.location.href = "/socio";
    } catch { setError("Sin conexión. Intenta de nuevo."); }
    finally { setBusy(false); setNip(""); }
  }

  const back =
    step === "pick" ? () => setStep("vehicle")
    : step === "socio" ? () => { setStep("who"); setError(""); }
    : step === "vehicle" && askService && slot ? () => { setStep("who"); setError(""); }
    : step === "who" && !askService ? () => { setStep("pick"); setSlot(null); }
    : step === "single" ? () => (askService ? setStep("vehicle") : service === "sencillo" ? setStep("who") : (setStep("pick"), setSlot(null)))
    : null;
  const title = step === "vehicle" ? (askService ? "¿Qué lavado y tamaño?" : service === "sencillo" ? "¿Qué vas a lavar?" : serviceLabel(service)) : step === "pick" ? "Elige día y hora" : step === "who" ? "Apartar" : step === "socio" ? "Soy socio" : step === "single" ? serviceLabel(service) : "Pagar";
  const startOnly = step === "who" || step === "socio" || step === "vehicle";

  const sheet = (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm md:grid md:place-items-center md:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-in relative flex h-full w-full flex-col overflow-hidden bg-ink text-white md:h-auto md:max-h-[92vh] md:max-w-lg md:rounded-[28px] md:border md:border-white/10">
        <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2.5" style={{ paddingTop: "max(.6rem, env(safe-area-inset-top))" }}>
          <button type="button" onClick={back ?? undefined} disabled={!back} aria-label="Regresar" className={`grid size-12 place-items-center rounded-full text-2xl ${back ? "bg-white/10" : "opacity-0"}`}>‹</button>
          <p className="min-w-0 flex-1 text-center text-lg font-bold">{title}</p>
          <button type="button" onClick={() => !busy && setOpen(false)} aria-label="Cerrar" className="grid size-12 place-items-center rounded-full bg-white/10 text-xl">✕</button>
        </header>

        {slot && step !== "pick" && (
          <div className="shrink-0 border-b border-white/10 px-5 py-3 text-center">
            <p className="text-base text-white/75">{dayText(slot.date)}{startOnly ? " · siguiente horario" : ` · ${vehicle === "suv" ? "SUV / pick up" : vehicleLabel(vehicle)}`}</p>
            <p className="num text-3xl font-bold text-gold">{startOnly ? range(slot.time, 0).split(/[–-]/)[0] : range(slot.time, SERVICE_DUR[service][vehicle])}</p>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {error && <p role="alert" className="mb-4 rounded-2xl bg-stop/15 p-4 text-base font-semibold text-red-200">{error}</p>}

          {step === "vehicle" && (
            <div className="grid gap-3">
              {askService && (
                <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/[.06] p-1" role="radiogroup" aria-label="Lavado">
                  {(["sencillo", "profundo", "detallado"] as Service[]).map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={service === k} onClick={() => setService(k)}
                      className={`min-h-14 rounded-xl px-1 text-[15px] font-semibold leading-tight transition ${service === k ? "bg-gold text-ink shadow" : "text-white/75"}`}>
                      {k === "sencillo" ? "Sencillo" : k === "profundo" ? "Profundo" : <>Detallado<span className="block text-xs opacity-80">exterior</span></>}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid gap-3" role="radiogroup" aria-label="Vehículo">
              {VEHICLES.map((v) => (
                <button key={v} type="button" role="radio" aria-checked={vehicle === v} onClick={() => chooseVehicle(v)} disabled={busy}
                  className="flex min-h-20 items-center justify-between rounded-2xl border-2 border-white/15 bg-white/[.04] px-5 text-left transition active:scale-[.98]">
                  <span><span className="block text-xl font-bold"><span className="num mr-2 rounded-md bg-white/10 px-1.5 py-0.5 text-sm">{SIZE_TAG[v]}</span>{vehicleLabel(v)}</span><span className="block text-sm text-white/60">{durText(SERVICE_DUR[service][v])}</span></span>
                  <span className="num text-xl font-bold text-gold">${prices[service][v].toLocaleString("es-MX")}</span>
                </button>
              ))}
              </div>
              <p className="text-center text-sm text-white/70">{service === "sencillo" ? "Precio de lavado sencillo. Si eres socio, no pagas." : `${serviceLabel(service)} · pago al reservar.`}</p>
            </div>
          )}

          {step === "pick" && <SlotPicker hours={hours} vehicle={vehicle} service={service} onPick={(date, time) => { setSlot({ date, time }); setStep(service === "sencillo" ? "who" : "single"); setError(""); }} />}

          {step === "who" && slot && (
            <div className="grid gap-3">
              <button type="button" onClick={() => { setStep("socio"); setError(""); }} className="flex min-h-24 items-center justify-between gap-3 rounded-3xl border-2 border-gold bg-gold/10 px-6 text-left active:scale-[.98]">
                <span><span className="block text-2xl font-bold">Soy socio</span><span className="block text-base text-white/80">Con tu celular y tu NIP</span></span>
                <span className="text-3xl text-gold" aria-hidden>›</span>
              </button>
              <button type="button" onClick={() => { setError(""); setStep(askService ? "vehicle" : "single"); }} className="flex min-h-24 items-center justify-between gap-3 rounded-3xl border-2 border-white/20 bg-white/[.05] px-6 text-left active:scale-[.98]">
                <span><span className="block text-2xl font-bold">Pagar un lavado</span><span className="block text-base text-white/80">{askService ? `Sencillo, profundo o detallado · desde $${prices.sencillo.carro}` : `${serviceLabel(service)} · $${prices[service][vehicle].toLocaleString("es-MX")}`}</span></span>
                <span className="text-3xl text-white/60" aria-hidden>›</span>
              </button>
            </div>
          )}

          {step === "socio" && slot && (
            <div className="grid gap-4">
              <label className="grid gap-1.5 text-base font-semibold text-white/90">Tu celular
                <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10 números" inputMode="tel" autoComplete="tel" maxLength={20} />
              </label>
              <label className="grid gap-1.5 text-base font-semibold text-white/90">Tu NIP (los 4 números que creaste)
                <input className={`${field} num text-center text-2xl tracking-[.5em]`} value={nip} onChange={(e) => setNip(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" inputMode="numeric" type="password" autoComplete="current-password" />
              </label>
              <p className="text-center text-base text-white/75">Se usa una de tus lavadas del mes. ¿Olvidaste tu NIP? En el lugar te lo cambiamos.</p>
            </div>
          )}

          {step === "single" && (
            <div className="grid gap-3">
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" maxLength={80} aria-label="Nombre" />
              <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Celular (10 dígitos)" inputMode="tel" autoComplete="tel" maxLength={20} aria-label="Celular" />
              <p className="text-center text-sm text-white/70">{service === "detallado" ? "Pintura descontaminada, pulido, abrillantado y encerado" : service === "profundo" ? "Todo lo del sencillo, a fondo" : "Por fuera y por dentro"} · {durText(SERVICE_DUR[service][vehicle])}. Al pagar aceptas nuestro <a href="/privacidad" target="_blank" className="text-gold underline">aviso de privacidad</a>.</p>
            </div>
          )}

          {step === "pay" && hold && (
            <div className="grid gap-4">
              <div className="flex items-center justify-between rounded-2xl border border-gold/40 bg-gold/[.07] px-4 py-3">
                <p className="num text-3xl font-bold text-gold">${hold.amount}</p>
                <div className="text-right"><p className="text-xs text-white/60">Tu lugar está apartado</p><p className={`num text-2xl font-bold ${left < 120 ? "text-stop" : ""}`}>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</p></div>
              </div>
              {left === 0 || !mpPublicKey ? (
                <button type="button" onClick={() => { setHold(null); setStep("pick"); setSlot(null); }} className="btn-gold min-h-16 w-full text-lg">Elegir otra vez</button>
              ) : (
                <MpButton checkoutUrl={`/api/booking/${hold.id}/checkout`} onError={setError} label={`Pagar $${hold.amount} con Mercado Pago`} />
              )}
            </div>
          )}
        </div>

        {step === "socio" && (
          <footer className="shrink-0 border-t border-white/10 px-4 pt-3" style={{ paddingBottom: "max(.8rem, env(safe-area-inset-bottom))" }}>
            <button type="button" onClick={memberBook} disabled={!!nipMissing || busy} className="btn-gold min-h-16 w-full text-lg disabled:opacity-45">
              {busy ? "Apartando…" : nipMissing || "Apartar con mi lavada"}
            </button>
          </footer>
        )}

        {step === "single" && (
          <footer className="shrink-0 border-t border-white/10 px-4 pt-3" style={{ paddingBottom: "max(.8rem, env(safe-area-inset-bottom))" }}>
            {mpPublicKey ? (
              <button type="button" onClick={reserve} disabled={!!missing || busy} className="btn-gold min-h-16 w-full text-lg disabled:opacity-45">
                {busy ? "Apartando…" : missing || `Pagar $${prices[service][vehicle].toLocaleString("es-MX")}`}
              </button>
            ) : <p className="py-4 text-center text-white/70">Los pagos en línea se están activando.</p>}
          </footer>
        )}
      </div>
    </div>
  );

  return mounted && open ? createPortal(sheet, document.body) : null;
}
