// Texto para los logs del servidor SIN llaves, correos ni números largos (regla B11). Sin dependencias.
/** Motivo de un fallo de pago: "MP 401: …" si respondió Mercado Pago; si no, el tipo de error y su código. */
export function mpReason(e: unknown): string {
  const err = e as { name?: string; message?: string; status?: number; cause?: { code?: string } } | null;
  const raw = err?.name === "MpError" && typeof err.status === "number"
    ? `MP ${err.status}: ${err.message ?? ""}`
    : `${err?.name ?? "Error"}: ${err?.message ?? String(e)}${err?.cause?.code ? ` (${err.cause.code})` : ""}`;
  return raw
    .replace(/Bearer\s+\S+/gi, "Bearer <llave>")
    .replace(/(APP_USR|TEST)-[\w-]+/g, "<llave>")
    .replace(/[\w.+-]+@[\w.-]+/g, "<correo>")
    .replace(/\d{6,}/g, "<n>")
    .slice(0, 220);
}
