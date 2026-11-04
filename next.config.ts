import type { NextConfig } from "next";

// CSP: solo lo necesario. Mercado Pago se agrega en la fase de pagos.
// En despliegues Preview se permite la barra de comentarios de Vercel (vercel.live).
const preview = process.env.VERCEL_ENV === "preview";
const live = preview ? " https://vercel.live" : "";
// Mercado Pago: SDK, campos seguros de tarjeta (iframes) y antifraude.
const mp = " https://*.mercadopago.com https://*.mercadolibre.com https://*.mlstatic.com https://*.mercadopago.com.mx https://*.mercadolibre.com.mx https://*.mercadolivre.com https://*.mercadopago.com.br";
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob:" + mp + (preview ? " https://vercel.live https://vercel.com" : ""),
  "media-src 'self'",
  "style-src 'self' 'unsafe-inline'" + mp + live,
  "font-src 'self' data:" + mp,
  "script-src 'self' 'unsafe-inline'" + mp + live + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  "connect-src 'self'" + mp + (preview ? " https://vercel.live wss://ws-us3.pusher.com" : ""),
  "frame-src" + mp + (preview ? " https://vercel.live" : ""),
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "report-uri /api/csp",
].join("; ");

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
export default config;
