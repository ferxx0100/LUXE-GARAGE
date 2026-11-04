// Quita datos personales de lo que llega del navegador antes de escribirlo en los logs (regla B11).
export const scrub = (v: unknown, max = 300) => String(v ?? "")
  .replace(/[\w.+-]+@[\w.-]+/g, "<correo>")
  .replace(/\d{6,}/g, "<n>")
  .replace(/[\r\n]+/g, " ")
  .slice(0, max);
