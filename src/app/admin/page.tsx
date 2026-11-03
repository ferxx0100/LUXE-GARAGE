"use client";
import { useState } from "react";

const MODES = [
  { mode: "LIBRE", label: "Libre", hint: "Se puede llegar ya", cls: "bg-emerald-500/15 border-emerald-400 text-emerald-300" },
  { mode: "OCUPADO", label: "Ocupado", hint: "Hay un auto adentro", cls: "bg-amber-500/15 border-amber-400 text-amber-300" },
  { mode: "BLOQUEADO", label: "Bloqueado", hint: "Cerrado manualmente", cls: "bg-zinc-500/15 border-zinc-400 text-zinc-300" },
] as const;

// Panel mínimo (fase 2). Fase 6: login real + 2FA + registro de auditoría.
export default function Admin() {
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState("");
  async function set(mode: string) {
    setMsg("…");
    const r = await fetch("/api/admin/garage", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ mode }),
    });
    setMsg(r.ok ? `Listo: ${mode}` : r.status === 401 ? "Clave incorrecta" : "Error");
  }
  return (
    <main className="mx-auto max-w-md p-6 pt-16">
      <h1 className="font-display text-2xl text-gold">Panel LUXE GARAGE</h1>
      <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Clave de administrador"
        className="mt-6 w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 outline-none focus:border-gold" />
      <div className="mt-6 grid gap-3">
        {MODES.map((m) => (
          <button key={m.mode} onClick={() => set(m.mode)} disabled={!key}
            className={`rounded-xl border px-5 py-5 text-left transition active:scale-[.98] disabled:opacity-40 ${m.cls}`}>
            <div className="text-xl font-semibold">{m.label}</div>
            <div className="text-sm opacity-80">{m.hint}</div>
          </button>
        ))}
      </div>
      <p className="mt-4 h-5 text-sm text-white/70" role="status">{msg}</p>
    </main>
  );
}
