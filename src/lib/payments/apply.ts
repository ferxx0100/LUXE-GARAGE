// Aplica un pago de Mercado Pago a su reserva o membresía. Lo usan el webhook y el regreso de Checkout Pro.
// Regla: el estado y el monto se leen SIEMPRE de la API (getPayment), nunca de la URL ni del aviso.
import { paymentDecision } from "../booking-core";
import { confirmBooking, getBooking, markPending } from "../bookings";
import { confirmMembership, getMembership, markMembershipPending } from "../memberships";
import { redis } from "../store";
import { getPayment, type MpPayment } from "./mercadopago";

export async function applyPayment(pay: MpPayment): Promise<"confirm" | "pending" | "mismatch" | "ignore"> {
  const ref = pay.external_reference ?? "";
  const b = await getBooking(ref);
  const m = b ? null : await getMembership(ref);
  const target = b ?? m;
  const decision = paymentDecision(pay, target);
  const pid = String(pay.id);
  if (!target) return decision;
  if (decision === "mismatch") console.error("pago: monto no coincide", target.code);
  if (decision === "confirm") {
    const first = (await redis("SET", `lg:paid:${pid}`, target.id, "NX", "EX", 30 * 24 * 3600)) === "OK";
    if (first || target.status !== "confirmed") await (b ? confirmBooking(target.id, pid) : confirmMembership(target.id, pid));
  }
  if (decision === "pending") await (b ? markPending(target.id, pid, pay.status) : markMembershipPending(target.id, pid, pay.status));
  return decision;
}

/**
 * El cliente regresa de Mercado Pago con ?payment_id=... en la URL de su recibo. Consultamos ese pago a la API
 * y solo lo aplicamos si es de ESTE recibo (external_reference). Si algo falla, el webhook lo hará después.
 */
export async function syncReturn(id: string, paymentId: string | undefined): Promise<void> {
  if (!paymentId || !/^\d{1,20}$/.test(paymentId)) return;
  try {
    const pay = await getPayment(paymentId);
    if (pay.external_reference === id) await applyPayment(pay);
  } catch {
    console.error("regreso de Mercado Pago: no se pudo consultar el pago");
  }
}
