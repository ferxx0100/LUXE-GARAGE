"use client";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window { MercadoPago?: new (key: string, o?: { locale?: string }) => { bricks: () => { create: (t: string, el: string, s: unknown) => Promise<{ unmount: () => void }> } } }
}

/** Avisa al servidor (logs de Vercel) por qué falló el formulario de pago. Sin datos personales. */
function report(where: string, err: unknown) {
  const e = err as { type?: string; message?: string; cause?: unknown } | undefined;
  const msg = [e?.type, e?.message, typeof e?.cause === "string" ? e.cause : e?.cause ? JSON.stringify(e.cause).slice(0, 120) : ""].filter(Boolean).join(" · ") || String(err);
  const body = JSON.stringify({ where, msg });
  try {
    if (!navigator.sendBeacon?.("/api/log", new Blob([body], { type: "application/json" }))) throw new Error("beacon");
  } catch {
    fetch("/api/log", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  }
}

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

interface Props {
  publicKey: string;
  amount: number;          // solo para mostrar en el formulario; el servidor cobra su propio monto
  payUrl: string;          // /api/booking/{id}/pay
  doneUrl: string;         // comprobante al que se va al aprobar
  onError: (msg: string) => void;
  accent?: string;
  id?: string;
  checkoutUrl?: string;    // /api/booking/{id}/checkout (Pagar con Mercado Pago)
  /** Cuerpo que se manda a payUrl (por defecto, el formulario del Brick tal cual). */
  wrap?: (form: unknown) => unknown;
  /** Estados de respuesta que cuentan como éxito (reserva: approved/pending/conflict; socio: active/pending). */
  okStatuses?: string[];
}

/**
 * Card Payment Brick de Mercado Pago: la tarjeta y el correo se capturan en campos de Mercado Pago
 * y nunca pasan por nuestro servidor (solo el token que genera el Brick).
 */
const OK = ["approved", "pending", "conflict"];

export default function PayBrick({ publicKey, amount, payUrl, doneUrl, onError, accent = "#d4af37", id = "mp-brick", checkoutUrl, wrap, okStatuses = OK }: Props) {
  const brickRef = useRef<{ unmount: () => void } | null>(null);
  const errRef = useRef(onError);
  useEffect(() => { errRef.current = onError; }, [onError]);

  useEffect(() => {
    let cancelled = false, settled = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        await loadMp();
        if (cancelled) { report("cerrado", "antes de crear el formulario"); return; }
        if (!window.MercadoPago) { report("carga", "SDK sin MercadoPago"); return; }
        report("inicio", "creando formulario");
        watchdog = setTimeout(() => { if (!settled) report("sin-respuesta", "20 s sin listo ni error"); }, 20000);
        const mp = new window.MercadoPago(publicKey, { locale: "es-MX" });
        const b = await mp.bricks().create("cardPayment", id, {
          initialization: { amount },
          customization: { visual: { style: { theme: "dark", customVariables: { baseColor: accent } } }, paymentMethods: { maxInstallments: 1 } },
          callbacks: {
            onReady: () => { settled = true; report("listo", "formulario visible"); },
            onError: (err: unknown) => { settled = true; report("brick", err); errRef.current("Hubo un problema con el formulario de pago. Recarga la página."); },
            onSubmit: (form: unknown) => new Promise<void>((resolve, reject) => {
              errRef.current("");
              fetch(payUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wrap ? wrap(form) : form) })
                .then(async (r) => {
                  const d = await r.json().catch(() => ({}));
                  if (okStatuses.includes(d.status)) { resolve(); window.location.href = doneUrl; }
                  else { errRef.current(d.error ?? "Pago rechazado. Revisa los datos de tu tarjeta."); reject(); }
                })
                .catch(() => { errRef.current("Sin conexión. Revisa tu cuenta antes de intentar otra vez."); reject(); });
            }),
          },
        });
        if (cancelled) b.unmount(); else brickRef.current = b;
      } catch (err) { report("carga", err); errRef.current("No se pudo cargar el pago. Revisa tu conexión y recarga."); }
    })();
    return () => { cancelled = true; if (watchdog) clearTimeout(watchdog); brickRef.current?.unmount(); brickRef.current = null; };
  }, [publicKey, amount, payUrl, doneUrl, accent, id]);

  return (
    <div className="grid gap-4">
      {checkoutUrl && <MpButton checkoutUrl={checkoutUrl} onError={onError} />}
      {checkoutUrl && (
        <p className="flex items-center gap-3 text-sm text-white/55" aria-hidden>
          <span className="h-px flex-1 bg-white/15" />o con tarjeta<span className="h-px flex-1 bg-white/15" />
        </p>
      )}
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[.03] p-3"><div id={id} /></div>
    </div>
  );
}

/** Pagar dentro de Mercado Pago (su cuenta, tarjetas guardadas o saldo). El link lo crea el servidor con su monto. */
export function MpButton({ checkoutUrl, onError, body, disabled, label = "Pagar con Mercado Pago" }: {
  checkoutUrl: string; onError: (m: string) => void; body?: unknown; disabled?: boolean; label?: string;
}) {
  const [busy, setBusy] = useState(false);
  async function go() {
    if (busy || disabled) return;
    setBusy(true); onError("");
    try {
      const r = await fetch(checkoutUrl, body === undefined ? { method: "POST" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && typeof d.url === "string" && (d.url.startsWith("https://") || d.url.startsWith("/"))) { window.location.assign(d.url); return; }
      onError(d.error ?? "No pudimos abrir Mercado Pago. Intenta de nuevo.");
    } catch { onError("Sin conexión. Intenta de nuevo."); }
    setBusy(false);
  }
  return (
    <div className="grid gap-2">
      <button type="button" onClick={go} disabled={busy || disabled}
        className="flex min-h-16 w-full flex-col items-center justify-center rounded-2xl bg-[#009ee3] px-6 text-white shadow-[0_12px_30px_rgba(0,158,227,.35)] transition active:scale-[.97] disabled:opacity-50">
        <span className="text-lg font-semibold">{busy ? "Abriendo Mercado Pago…" : label}</span>
        {!busy && <span className="text-[13px] text-white/85">Tarjeta de crédito o débito, o tu cuenta Mercado Pago</span>}
      </button>
      {/* Confianza: el cliente sabe dónde escribe su tarjeta. */}
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-white/55">
        <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        Pago seguro en Mercado Pago. Tu tarjeta nunca pasa por nuestro sitio.
      </p>
    </div>
  );
}

/** Para el recibo: reintentar el pago en Mercado Pago mientras el apartado siga vigente (con su propio mensaje de error). */
export function MpCheckout({ checkoutUrl }: { checkoutUrl: string }) {
  const [error, setError] = useState("");
  return (
    <div className="grid gap-3">
      <MpButton checkoutUrl={checkoutUrl} onError={setError} />
      {error && <p role="alert" className="rounded-2xl bg-red-500/20 p-4 text-base font-medium text-red-100">{error}</p>}
    </div>
  );
}
