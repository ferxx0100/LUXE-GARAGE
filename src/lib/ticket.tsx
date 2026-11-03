// Imagen PNG del ticket para guardar en el celular (reserva o membresía). Se dibuja en el servidor con next/og.
// No lleva teléfono, correo ni dirección (ver bookingTicket/membershipTicket en booking-core).
import { ImageResponse } from "next/og";
import type { TicketData } from "./booking-core";

const TONE = {
  gold: { accent: "#d4af37", soft: "#f1d77a", bg: "linear-gradient(180deg, #121214 0%, #1c170a 100%)", line: "rgba(212,175,55,.45)" },
  cyan: { accent: "#22d3ee", soft: "#a5f3fc", bg: "linear-gradient(180deg, #031b2e 0%, #063a5b 100%)", line: "rgba(103,232,249,.45)" },
} as const;

export function ticketImage(t: TicketData, filename: string): ImageResponse {
  const c = TONE[t.tone];
  const height = 1500 + t.washes.length * 70;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundImage: c.bg, color: "#ffffff", padding: "72px 78px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 46, letterSpacing: 14, color: c.soft }}>LUXE GARAGE</div>
          <div style={{ fontSize: 28, color: "rgba(255,255,255,.55)" }}>Zamora, Mich.</div>
        </div>
        <div style={{ display: "flex", height: 3, marginTop: 34, backgroundColor: c.line }} />

        <div style={{ display: "flex", marginTop: 70, fontSize: 32, letterSpacing: 8, color: "rgba(255,255,255,.6)" }}>{t.kicker.toUpperCase()}</div>
        <div style={{ display: "flex", marginTop: 8, fontSize: 124, letterSpacing: 4, color: c.accent }}>{t.code}</div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 50, borderTop: `3px dashed ${c.line}`, paddingTop: 40 }}>
          {t.rows.map((r) => (
            <div key={r.label} style={{ display: "flex", flexDirection: "column", marginBottom: 34 }}>
              <div style={{ fontSize: 28, color: "rgba(255,255,255,.55)" }}>{r.label}</div>
              <div style={{ fontSize: 50, marginTop: 4 }}>{r.value}</div>
            </div>
          ))}
        </div>

        {t.washes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 6 }}>
            <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,.55)" }}>{`Tus ${t.washes.length} lavadas`}</div>
            {t.washes.map((w, i) => (
              <div key={w.day} style={{ display: "flex", alignItems: "center", marginTop: 22 }}>
                <div style={{ display: "flex", width: 64, height: 64, borderRadius: 32, backgroundColor: c.accent, color: "#031b2e", alignItems: "center", justifyContent: "center", fontSize: 32, marginRight: 26 }}>{String(i + 1)}</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", fontSize: 42 }}>{w.day}</div>
                  <div style={{ display: "flex", fontSize: 32, color: "rgba(255,255,255,.7)" }}>{w.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div style={{ display: "flex", fontSize: 54, color: c.soft }}>{t.total}</div>
          <div style={{ display: "flex", height: 3, marginTop: 34, marginBottom: 30, backgroundColor: c.line }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, color: "rgba(255,255,255,.7)" }}>
            <div style={{ display: "flex" }}>Muestra este código al llegar</div>
            <div style={{ display: "flex" }}>luxegaragee.com</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080, height,
      headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="${filename}"`, "X-Robots-Tag": "noindex" },
    },
  );
}
