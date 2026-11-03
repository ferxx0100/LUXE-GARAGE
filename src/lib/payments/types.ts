// Módulo de pagos aislado: la tienda solo conoce esta interfaz.
// Hoy: Mercado Pago (Checkout API). Mañana: Stripe, sin tocar la tienda.
export interface ChargeInput {
  reservationId: string;
  amountMXN: number; // lo calcula el servidor, nunca el navegador
  cardToken: string; // token temporal del proveedor; jamás datos de tarjeta
  payerEmail: string;
}
export type PaymentStatus = "approved" | "pending" | "rejected";
export interface PaymentProvider {
  readonly id: "mercadopago" | "stripe";
  charge(input: ChargeInput): Promise<{ paymentId: string; status: PaymentStatus }>;
  /** Consulta el pago al proveedor (no confiar en el body del webhook). */
  getPayment(paymentId: string): Promise<{ status: PaymentStatus; reservationId: string }>;
  verifyWebhook(headers: Headers, dataId: string): boolean;
}
