import type { NextConfig } from "next";

// CSP: solo lo necesario. Mercado Pago se agrega en la fase de pagos.
// En despliegues Preview se permite la barra de comentarios de Vercel (vercel.live).
const preview = process.env.VERCEL_ENV === "preview";
const live = preview ? " https://vercel.live" : "";
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob:" + (preview ? " https://vercel.live https://vercel.com" : ""),
  "media-src 'self'",
  "style-src 'self' 'unsafe-inline'" + live,
  "script-src 'self' 'unsafe-inline'" + live + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  "connect-src 'self'" + (preview ? " https://vercel.live wss://ws-us3.pusher.com" : ""),
  "frame-src" + (preview ? " https://vercel.live" : " 'none'"),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
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
