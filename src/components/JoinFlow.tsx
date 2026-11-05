"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MpButton } from "./PayBrick";
import { VEHICLES, vehicleLabel, type Vehicle } from "./fmt";

const field = "w-full min-h-16 rounded-2xl border-2 border-white/15 bg-black/30 px-5 text-lg text-white outline-none placeholder:text-white/35 focus:border-gold";
const digits = (s: string) => s.replace(/\D/g, "");

/**
 * Hazte socio en 3 pasos que no se mueven: (1) carro, camioneta o SUV/pick up, (2) nombre, celular y NIP, (3) pago.
 * Al pagar entra solo a su cuenta (/socio). Se abre sobre toda la pantalla (portal al body).
 */
export default function JoinFlow({ prices, washes, mpPublicKey, soldOut, label = "Hazte socio", className = "btn-gold min-h-16 w-full text-lg", preset }: {
  prices: Record<Vehicle, number>; washes: number; mpPublicKey: string | null; soldOut?: boolean; label?: string; className?: string;
  /** Vehículo ya elegido en el plan: abre directo en "tus datos". */
  preset?: Vehicle;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nip, setNip] = useState("");
  const [nip2, setNip2] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [member, setMember] = useState<{ id: string; amount: number } | null>(null);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [open, busy]);

  const missing = name.trim().length < 2 ? "Escribe tu nombre" : digits(phone).length < 10 ? "Escribe tu celular" : nip.length < 4 ? "Crea tu NIP de 4 números" : nip !== nip2 ? "Repite tu NIP igual" : "";

  async function toPay() {
    if (missing || busy || !vehicle) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/socio/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vehicle, name, phone, nip }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "No pudimos guardar tus datos."); return; }
      setMember({ id: d.id, amount: d.amount }); setStep(3);
    } catch { setError("Sin conexión. Intenta de nuevo."); }
    finally { setBusy(false); }
  }

  const back = step === 2 ? () => setStep(1) : step === 3 ? () => { setStep(2); setMember(null); } : null;

  const sheet = (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm md:grid md:place-items-center md:p-6" role="dialog" aria-modal="true" aria-label="Hazte socio">
      <div className="sheet-in relative flex h-full w-full flex-col overflow-hidden bg-ink text-white md:h-auto md:max-h-[92vh] md:max-w-lg md:rounded-[28px] md:border md:border-white/10">
        <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2.5" style={{ paddingTop: "max(.6rem, env(safe-area-inset-top))" }}>
          <button type="button" onClick={back ?? undefined} disabled={!back} aria-label="Regresar" className={`grid size-12 place-items-center rounded-full text-2xl ${back ? "bg-white/10" : "opacity-0"}`}>‹</button>
          <div className="min-w-0 flex-1 text-center">
            <p className="font-display text-xl font-semibold tracking-[.02em] text-gold">Hazte socio</p>
            <p className="text-sm text-white/60">Paso {step} de 3</p>
          </div>
          <button type="button" onClick={() => !busy && setOpen(false)} aria-label="Cerrar" className="grid size-12 place-items-center rounded-full bg-white/10 text-xl">✕</button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
          {error && <p role="alert" className="mb-4 rounded-2xl bg-stop/15 p-4 text-base font-semibold text-red-200">{error}</p>}

          {step === 1 && (
            <div className="grid gap-3">
              <p className="text-center text-xl font-bold">¿Qué manejas?</p>
              {VEHICLES.map((v) => (
                <button key={v} type="button" onClick={() => { setVehicle(v); setStep(2); setError(""); }}
                  className={`flex min-h-24 items-center justify-between rounded-3xl border-2 px-6 text-left transition active:scale-[.98] ${vehicle === v ? "border-gold bg-gold/10" : "border-white/12 bg-white/[.04]"}`}>
                  <span className="text-2xl font-bold">{vehicleLabel(v)}</span>
                  <span className="text-right"><span className="num block text-3xl font-bold text-gold">${prices[v]}</span><span className="block text-sm text-white/60">al mes</span></span>
                </button>
              ))}
              <p className="mt-2 text-center text-base text-white/70">{washes} lavadas completas al mes.<br />Por dentro y por fuera.</p>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3">
              <p className="text-center text-xl font-bold">Tus datos</p>
              <label className="grid gap-1.5 text-base font-semibold text-white/90">Tu nombre
                <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Juan Pérez" autoComplete="name" maxLength={80} />
              </label>
              <label className="grid gap-1.5 text-base font-semibold text-white/90">Tu celular (10 números)
                <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej. 351 000 0000" inputMode="tel" autoComplete="tel" maxLength={20} />
              </label>
              {/* Qué es el NIP, dicho fácil y visible (para quien usa lentes también). */}
              <div className="mt-1 rounded-2xl border-2 border-gold/40 bg-gold/[.07] p-4">
                <p className="text-lg font-bold text-gold">Crea tu NIP: 4 números</p>
                <p className="mt-1 text-base leading-snug text-white/90">Es tu clave secreta, como la de tu tarjeta del banco. Tú la inventas. Con tu celular y tu NIP entras a tu cuenta para apartar tus lavadas.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5 text-base font-semibold text-white/90">Tu NIP
                  <input className={`${field} num text-center text-2xl tracking-[.5em]`} value={nip} onChange={(e) => setNip(digits(e.target.value).slice(0, 4))} placeholder="••••" inputMode="numeric" type="password" autoComplete="new-password" />
                </label>
                <label className="grid gap-1.5 text-base font-semibold text-white/90">Repítelo
                  <input className={`${field} num text-center text-2xl tracking-[.5em]`} value={nip2} onChange={(e) => setNip2(digits(e.target.value).slice(0, 4))} placeholder="••••" inputMode="numeric" type="password" autoComplete="new-password" />
                </label>
              </div>
              {nip.length === 4 && nip2.length === 4 && nip !== nip2 && <p role="alert" className="text-center text-base font-semibold text-red-300">Los dos NIP no son iguales.</p>}
              <p className="text-center text-base text-white/80">Apúntalo o recuérdalo. Si lo olvidas, en el lugar te lo cambiamos.</p>
              <p className="text-center text-sm text-white/70">Al continuar aceptas nuestro <a href="/privacidad" target="_blank" className="text-gold underline">aviso de privacidad</a>.</p>
            </div>
          )}

          {step === 3 && member && vehicle && (
            <div className="grid gap-4">
              <div className="rounded-3xl border border-gold/40 bg-gold/[.07] p-5 text-center">
                <p className="text-base text-white/75">{vehicleLabel(vehicle)} · {washes} lavadas al mes</p>
                <p className="num mt-1 text-4xl font-bold text-gold">${member.amount} <span className="text-lg font-semibold text-white/70">al mes</span></p>
                <p className="mt-2 text-base text-white/80">Se cobra solo cada mes. Cancelas cuando quieras.</p>
              </div>
              {mpPublicKey ? (
                <>
                  <label className="grid gap-1.5 text-sm font-semibold text-white/70">Tu correo (ahí te llega el comprobante)
                    <input className={field} value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="tucorreo@ejemplo.com" inputMode="email" autoComplete="email" maxLength={120} />
                  </label>
                  <MpButton checkoutUrl="/api/socio/checkout" body={{ id: member.id, email }} disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)} onError={setError} label={`Pagar $${member.amount} con Mercado Pago`} />
                  <p className="text-center text-sm text-white/75">En Mercado Pago pones tu tarjeta y autorizas el cobro mensual. Al terminar regresas a tu cuenta.</p>
                </>
              ) : <p className="text-center text-white/70">Los pagos en línea se están activando.</p>}
            </div>
          )}
        </div>

        {step === 2 && (
          <footer className="shrink-0 border-t border-white/10 px-4 pt-3" style={{ paddingBottom: "max(.8rem, env(safe-area-inset-bottom))" }}>
            <button type="button" onClick={toPay} disabled={!!missing || busy} className="btn-gold min-h-16 w-full text-lg disabled:opacity-45">
              {busy ? "Guardando…" : missing || `Ir a pagar $${vehicle ? prices[vehicle] : ""}`}
            </button>
          </footer>
        )}
      </div>
    </div>
  );

  if (soldOut) return <p className="rounded-2xl bg-white/[.06] p-4 text-center text-base font-semibold text-white/80">Lugares de socio agotados por ahora.</p>;
  return (
    <>
      <button type="button" onClick={() => { if (preset) { setVehicle(preset); setStep(2); } setOpen(true); setError(""); }} className={className}>{label}</button>
      {mounted && open && createPortal(sheet, document.body)}
    </>
  );
}
