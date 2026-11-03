// Mercado Pago (Checkout API + Card Payment Brick). Solo servidor: usa el Access Token.
// El navegador nunca ve datos de tarjeta: el Brick de Mercado Pago los convierte en un token.
import { createHash } from "node:crypto";
import { z } from "zod";
import { SITE_URL } from "../config";

const BASE = process.env.MP_API_BASE ?? "https://api.mercadopago.com"; // MP_API_BASE: solo para pruebas locales
export const mpConfigured = () => !!process.env.MP_ACCESS_TOKEN;

export class MpError extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function mp<T>(path: string, init: RequestInit & { idempotency?: string } = {}): Promise<T> {
  const r = await fetch(BASE + path, {
    ...init,
    headers: {
      authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      "content-type": "application/json",
      ...(init.idempotency ? { "x-idempotency-key": init.idempotency } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const data = (await r.json().catch(() => ({}))) as T & { message?: string };
  if (!r.ok) throw new MpError(r.status, data.message ?? `Mercado Pago ${r.status}`);
  return data;
}

export interface CardForm {
  token: string; payment_method_id: string; issuer_id?: string | number; installments?: number;
  payer?: { email?: string; identification?: { type?: string; number?: string } };
}
/** Lo que manda el Card Payment Brick (un token, nunca la tarjeta). */
export const CardFormSchema = z.object({
  token: z.string().min(8).max(200),
  payment_method_id: z.string().min(2).max(40),
  issuer_id: z.union([z.string().max(40), z.number()]).optional(),
  installments: z.number().int().optional(),
  payer: z.object({ email: z.string().email().max(120).optional(), identification: z.object({ type: z.string().max(20).optional(), number: z.string().max(30).optional() }).optional() }).optional(),
});

export interface MpPayment { id: number | string; status: string; status_detail?: string; external_reference?: string; transaction_amount?: number }

/**
 * Cobra el monto de la reserva o membresía (calculado en el servidor, nunca el del navegador).
 * `id` = reserva o membresía (external_reference). `description` aparece en el recibo de Mercado Pago.
 */
export async function chargeCard(b: { id: string; code: string; amount: number; email: string; description: string }, form: CardForm) {
  const idem = `${b.id}-${createHash("sha256").update(form.token).digest("hex").slice(0, 16)}`;
  const body = {
    transaction_amount: b.amount,
    token: form.token,
    description: b.description.slice(0, 200),
    installments: 1,
    payment_method_id: form.payment_method_id,
    ...(form.issuer_id ? { issuer_id: Number(form.issuer_id) } : {}),
    payer: {
      email: form.payer?.email || b.email,
      ...(form.payer?.identification?.number ? { identification: form.payer.identification } : {}),
    },
    external_reference: b.id,
    notification_url: `${process.env.SITE_URL ?? SITE_URL}/api/mp/webhook`,
    statement_descriptor: "LUXE GARAGE",
    metadata: { code: b.code },
  };
  return mp<MpPayment>("/v1/payments", { method: "POST", body: JSON.stringify(body), idempotency: idem });
}

export const getPayment = (id: string) => mp<MpPayment>(`/v1/payments/${encodeURIComponent(id)}`);

/** Mensajes claros para el cliente según el motivo de rechazo. */
export function rejectMessage(detail?: string): string {
  const m: Record<string, string> = {
    cc_rejected_insufficient_amount: "Fondos insuficientes. Intenta con otra tarjeta.",
    cc_rejected_bad_filled_security_code: "El código de seguridad (CVV) es incorrecto.",
    cc_rejected_bad_filled_date: "La fecha de vencimiento es incorrecta.",
    cc_rejected_bad_filled_card_number: "Revisa el número de la tarjeta.",
    cc_rejected_bad_filled_other: "Revisa los datos de la tarjeta.",
    cc_rejected_call_for_authorize: "Tu banco pide que autorices el pago. Llámales y vuelve a intentar.",
    cc_rejected_card_disabled: "Tu tarjeta está desactivada. Actívala con tu banco o usa otra.",
    cc_rejected_duplicated_payment: "Ya hiciste un pago igual hace un momento.",
    cc_rejected_high_risk: "El pago fue rechazado por seguridad. Intenta con otra tarjeta.",
    cc_rejected_max_attempts: "Llegaste al límite de intentos. Usa otra tarjeta.",
  };
  return m[detail ?? ""] ?? "El pago fue rechazado. Intenta con otra tarjeta.";
}
