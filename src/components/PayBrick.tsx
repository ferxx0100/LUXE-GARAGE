"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window { MercadoPago?: new (key: string, o?: { locale?: string }) => { bricks: () => { create: (t: string, el: string, s: unknown) => Promise<{ unmount: () => void }> } } }
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
  payUrl: string;          // /api/booking/{id}/pay o /api/membership/{id}/pay
  doneUrl: string;         // comprobante al que se va al aprobar
  onError: (msg: string) => void;
  accent?: string;
  id?: string;
}

/**
 * Card Payment Brick de Mercado Pago: la tarjeta y el correo se capturan en campos de Mercado Pago
 * y nunca pasan por nuestro servidor (solo el token que genera el Brick).
 */
export default function PayBrick({ publicKey, amount, payUrl, doneUrl, onError, accent = "#d4af37", id = "mp-brick" }: Props) {
  const brickRef = useRef<{ unmount: () => void } | null>(null);
  const errRef = useRef(onError);
  useEffect(() => { errRef.current = onError; }, [onError]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadMp();
        if (cancelled || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey, { locale: "es-MX" });
        const b = await mp.bricks().create("cardPayment", id, {
          initialization: { amount },
          customization: { visual: { style: { theme: "dark", customVariables: { baseColor: accent } } }, paymentMethods: { maxInstallments: 1 } },
          callbacks: {
            onReady: () => {},
            onError: () => errRef.current("Hubo un problema con el formulario de pago. Recarga la página."),
            onSubmit: (form: unknown) => new Promise<void>((resolve, reject) => {
              errRef.current("");
              fetch(payUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) })
                .then(async (r) => {
                  const d = await r.json().catch(() => ({}));
                  if (["approved", "pending", "conflict"].includes(d.status)) { resolve(); window.location.href = doneUrl; }
                  else { errRef.current(d.error ?? "Pago rechazado. Revisa los datos de tu tarjeta."); reject(); }
                })
                .catch(() => { errRef.current("Sin conexión. No se hizo ningún cargo."); reject(); });
            }),
          },
        });
        if (cancelled) b.unmount(); else brickRef.current = b;
      } catch { errRef.current("No se pudo cargar el pago. Revisa tu conexión y recarga."); }
    })();
    return () => { cancelled = true; brickRef.current?.unmount(); brickRef.current = null; };
  }, [publicKey, amount, payUrl, doneUrl, accent, id]);

  return <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[.03] p-3"><div id={id} /></div>;
}
