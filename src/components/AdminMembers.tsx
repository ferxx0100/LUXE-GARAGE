"use client";
import { vehicleLabel } from "./fmt";
import { useCallback, useEffect, useState } from "react";

type Row = { id: string; code: string; name: string; phone: string; vehicle: "carro" | "camioneta" | "suv"; status: string; valid: boolean; periodEnd: string | null; perPeriod: number; used: number;
  payments: { n: number; at: string; amount: number }[]; history: { date: string; time: string; status: string; doneBy: string | null }[] };
const day = (d: string) => `${Number(d.slice(8))} ${MONTH[Number(d.slice(5, 7)) - 1]}`;
const MONTH = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const until = (end: string) => { const d = new Date(`${end}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`; };

/** Socios (solo el dueño): cuántos hay contra el tope, quién está vigente y restablecer NIP. */
export default function AdminMembers({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [data, setData] = useState<{ cap: number; active: number; members: Row[] } | null>(null);
  const [nip, setNip] = useState<{ name: string; nip: string } | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/members", { cache: "no-store" });
    if (r.status === 401) return onUnauthorized();
    if (r.ok) setData(await r.json());
  }, [onUnauthorized]);
  useEffect(() => { load(); }, [load]);

  async function reset(m: Row) {
    if (!confirm(`¿Darle un NIP nuevo a ${m.name}? El anterior deja de servir.`)) return;
    const r = await fetch(`/api/admin/members/${m.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reset-nip" }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setNip({ name: d.name, nip: d.nip });
  }

  if (!data) return <p className="text-white/60">Cargando…</p>;
  const list = data.members.filter((m) => !q || `${m.name} ${m.phone} ${m.code}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/[.05] p-4 text-center"><p className="num text-3xl font-bold text-gold">{data.active}</p><p className="text-sm text-white/60">vigentes</p></div>
        <div className="rounded-2xl bg-white/[.05] p-4 text-center"><p className="num text-3xl font-bold">{Math.max(0, data.cap - data.active)}</p><p className="text-sm text-white/60">lugares libres (tope {data.cap})</p></div>
      </div>
      {nip && (
        <div className="rounded-2xl border border-gold bg-gold/10 p-4 text-center" role="status">
          <p className="text-sm text-white/75">NIP nuevo de {nip.name} (dáselo y guárdalo bien; no se vuelve a mostrar):</p>
          <p className="num mt-1 text-4xl font-bold tracking-[.4em] text-gold">{nip.nip}</p>
          <button type="button" onClick={() => setNip(null)} className="mt-2 min-h-11 px-4 text-sm underline">Listo</button>
        </div>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, celular o código" className="min-h-14 w-full rounded-2xl border border-white/15 bg-white/5 px-4 outline-none focus:border-gold" />
      {list.length === 0 ? <p className="rounded-2xl bg-white/[.04] p-4 text-white/70">Sin socios todavía.</p> : (
        <ul className="grid gap-2">
          {list.map((m) => (
            <li key={m.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold">{m.name}</p>
                  <p className="num text-sm text-white/65">{m.phone} · {m.code} · {vehicleLabel(m.vehicle)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${m.valid ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-200"}`}>{m.valid ? `Hasta ${m.periodEnd ? until(m.periodEnd) : ""}` : m.status === "pending" ? "Sin cobro" : "Vencido"}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-white/70">Lavadas del mes: <b className="num text-white">{m.used} de {m.perPeriod}</b></p>
                <span className="flex gap-2">
                  <button type="button" onClick={() => setOpen(open === m.id ? null : m.id)} className="min-h-11 rounded-full border border-white/20 px-4 text-sm font-semibold">{open === m.id ? "Cerrar" : "Historial"}</button>
                  <button type="button" onClick={() => reset(m)} className="min-h-11 rounded-full border border-white/20 px-4 text-sm font-semibold">Nuevo NIP</button>
                </span>
              </div>
              {open === m.id && (
                <div className="mt-3 grid gap-3 border-t border-white/10 pt-3 text-sm">
                  <div>
                    <p className="font-semibold text-white/80">Pagos (Mercado Pago)</p>
                    {m.payments.length === 0 ? <p className="text-white/55">Ningún cobro aprobado todavía.</p> : m.payments.map((p) => (
                      <p key={p.n} className="num flex justify-between text-white/75"><span>Mes {p.n} · {new Date(p.at).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short" })}</span><span>${p.amount}</span></p>
                    ))}
                  </div>
                  <div>
                    <p className="font-semibold text-white/80">Lavadas</p>
                    {m.history.length === 0 ? <p className="text-white/55">Sin lavadas.</p> : m.history.map((h, i) => (
                      <p key={i} className="num flex justify-between text-white/75"><span>{day(h.date)} · {h.time}</span><span>{h.status === "done" ? `✓ ${h.doneBy ?? "Sellada"}` : "Apartada"}</span></p>
                    ))}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
