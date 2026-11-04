"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PayBrick from "./PayBrick";
import SlotPicker from "./SlotPicker";
import { DAY, MONTH, toMin, wd, type DayHours, type Vehicle } from "./fmt";

export type ReserveDetail = { date?: string; time?: string };
/** Abre la ventana de apartar desde cualquier botón: window.dispatchEvent(new CustomEvent("lg:reserve", { detail })) */
export const openReserve = (detail: ReserveDetail = {}) => window.dispatchEvent(new CustomEvent("lg:reserve", { detail }));

const field = "w-full min-h-16 rounded-2xl border-2 border-white/15 bg-black/30 px-5 text-lg text-white outline-none placeholder:text-white/40 focus:border-gold";
const pad = (n: number) => String(n).padStart(2, "0");
const range = (t: string) => { const a = toMin(t), f = (x: number) => `${Math.floor(x / 60) % 12 || 12}:${pad(x % 60)}`; return `${f(a)}–${f(a + 30)}`; };
const dayText = (d: string) => `${DAY[wd(d)]} ${Number(d.slice(8))} de ${MONTH[Number(d.slice(5, 7)) - 1]}`;

/**
 * Apartar un turno, igual para todos: (1) día y hora → (2) "Soy socio" o "Lavada suelta" → (3) pagar (solo la suelta).
 * Los socios terminan en su cuenta (/socio) con el turno ya elegido.
 */
export default function ReserveSheet({ hours, prices, mpPublicKey }: { hours: DayHours[]; prices: Record<Vehicle, number>; mpPublicKey: string | null }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<{ date: string; time: string } | null>(null);
  const [step, setStep] = useState<"pick" | "who" | "single" | "pay">("pick");
  const [vehicle, setVehicle] = useState<Vehicle>("carro");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hold, setHold] = useState<{ id: string; amount: number; until: number } | null>(null);
  const [left, setLeft] = useState(0);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<ReserveDetail>).detail ?? {};
      const ok = d.date && d.time && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && /^\d{2}:\d{2}$/.test(d.time);
      setSlot(ok ? { date: d.date!, time: d.time! } : null);
      setStep(ok ? "who" : "pick"); setError(""); setHold(null); setOpen(true);
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
        body: JSON.stringify({ date: slot.date, time: slot.time, vehicle, kind: "completo", place: "garage", address: "", name, phone }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "No se pudo apartar. Intenta de nuevo."); if (r.status === 409) { setStep("pick"); setSlot(null); } return; }
      setHold({ id: d.id, amount: d.amount, until: Date.now() + 15 * 60 * 1000 }); setStep("pay");
    } catch { setError("Sin conexión. Intenta de nuevo."); }
    finally { setBusy(false); }
  }

  const back = step === "who" ? () => { setStep("pick"); setSlot(null); } : step === "single" ? () => setStep("who") : null;
  const title = step === "pick" ? "Elige día y hora" : step === "who" ? "Apartar" : step === "single" ? "Lavada normal" : "Pagar";

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
            <p className="text-base text-white/70">{dayText(slot.date)}</p>
            <p className="num text-3xl font-bold text-gold">{range(slot.time)}</p>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {error && <p role="alert" className="mb-4 rounded-2xl bg-stop/15 p-4 text-base font-semibold text-red-200">{error}</p>}

          {step === "pick" && <SlotPicker hours={hours} onPick={(date, time) => { setSlot({ date, time }); setStep("who"); setError(""); }} />}

          {step === "who" && slot && (
            <div className="grid gap-3">
              <a href={`/socio?d=${slot.date}&t=${slot.time}`} className="flex min-h-20 items-center justify-between rounded-3xl border-2 border-gold bg-gold/10 px-6 active:scale-[.98]">
                <span className="text-xl font-bold">Soy socio</span><span className="text-sm text-white/70">Usa una de tus lavadas</span>
              </a>
              <button type="button" onClick={() => setStep("single")} className="flex min-h-20 items-center justify-between rounded-3xl border-2 border-white/15 bg-white/[.04] px-6 text-left active:scale-[.98]">
                <span className="text-xl font-bold">Lavada normal</span><span className="num text-sm text-white/70">Desde ${Math.min(prices.carro, prices.camioneta)}</span>
              </button>
            </div>
          )}

          {step === "single" && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Vehículo">
                {(["carro", "camioneta"] as const).map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={vehicle === v} onClick={() => setVehicle(v)}
                    className={`min-h-20 rounded-2xl border-2 text-center transition ${vehicle === v ? "border-gold bg-gold text-ink" : "border-white/15 bg-white/[.04]"}`}>
                    <span className="block text-lg font-bold">{v === "carro" ? "Carro" : "Camioneta"}</span>
                    <span className="num block text-xl font-bold">${prices[v]}</span>
                  </button>
                ))}
              </div>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" maxLength={80} aria-label="Nombre" />
              <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Celular (10 dígitos)" inputMode="tel" autoComplete="tel" maxLength={20} aria-label="Celular" />
              <p className="text-center text-xs text-white/50">Lavado por dentro y por fuera, 30 min. Al pagar aceptas nuestro <a href="/privacidad" target="_blank" className="text-gold underline">aviso de privacidad</a>.</p>
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
                <PayBrick publicKey={mpPublicKey} amount={hold.amount} payUrl={`/api/booking/${hold.id}/pay`} checkoutUrl={`/api/booking/${hold.id}/checkout`} doneUrl={`/reserva/${hold.id}`} onError={setError} />
              )}
            </div>
          )}
        </div>

        {step === "single" && (
          <footer className="shrink-0 border-t border-white/10 px-4 pt-3" style={{ paddingBottom: "max(.8rem, env(safe-area-inset-bottom))" }}>
            {mpPublicKey ? (
              <button type="button" onClick={reserve} disabled={!!missing || busy} className="btn-gold min-h-16 w-full text-lg disabled:opacity-45">
                {busy ? "Apartando…" : missing || `Pagar $${prices[vehicle]}`}
              </button>
            ) : <p className="py-4 text-center text-white/70">Los pagos en línea se están activando.</p>}
          </footer>
        )}
      </div>
    </div>
  );

  return mounted && open ? createPortal(sheet, document.body) : null;
}
