// Respuestas JSON sin caché (todas las rutas de socio y panel).
export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/** IP del cliente (para limitar intentos). */
export const clientIp = (req: Request) => (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
