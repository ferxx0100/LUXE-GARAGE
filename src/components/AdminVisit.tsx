"use client";
import { useState } from "react";
import { vehicleLabel } from "./fmt";

const field = "min-h-14 w-full rounded-xl border-2 border-white/15 bg-black/30 px-4 text-lg text-white outline-none placeholder:text-white/40 focus:border-gold";

/**
 * Registrar lavada de socio en el lugar: el CLIENTE teclea su celular y su NIP.
 * Si es válido, queda registrada y sellada ("Lavada 2 de 4") con el nombre de quien atiende.
 */
export default function AdminVisit({ onUnauthorized, onDone }: { onUnauthorized: () => void; onDone: () => void }) {
  const [phone, setPhone] = useState("");
  const [nip, setNip] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; t: string } | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setRes(null);
    const r = await fetch("/api/admin/visit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, nip }) });
    setBusy(false); setNip("");
    if (r.status === 401) return onUnauthorized();
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setPhone(""); setRes({ ok: true, t: `${d.name} · ${d.code} — Lavada ${d.number} de ${d.of} registrada. Revisa que sea ${vehicleLabel(d.vehicle).toLowerCase()}.` }); onDone(); }
    else setRes({ ok: false, t: d.error ?? "No se pudo registrar." });
  }

  return (
    <section className="rounded-3xl border-2 border-gold/50 bg-white/[.04] p-4">
      <h2 className="text-lg font-bold">Registrar lavada de socio</h2>
      <p className="mt-1 text-sm text-white/60">El cliente escribe su celular y su NIP.</p>
      <form onSubmit={go} className="mt-3 grid gap-2">
        <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Celular (10 dígitos)" inputMode="tel" autoComplete="off" maxLength={20} aria-label="Celular del socio" />
        <input className={`${field} num text-center text-2xl tracking-[.5em]`} value={nip} onChange={(e) => setNip(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="NIP" inputMode="numeric" type="password" autoComplete="off" aria-label="NIP del socio" />
        <button disabled={busy || phone.replace(/\D/g, "").length < 10 || nip.length < 4} className="btn-gold min-h-14 text-lg disabled:opacity-45">{busy ? "Registrando…" : "Registrar lavada"}</button>
      </form>
      {res && <p role="status" className={`mt-3 rounded-xl p-3 text-base font-semibold ${res.ok ? "bg-emerald-500/15 text-emerald-200" : "bg-red-500/15 text-red-200"}`}>{res.ok ? "✓ " : ""}{res.t}</p>}
    </section>
  );
}
