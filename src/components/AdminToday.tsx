"use client";
import { useCallback, useEffect, useState } from "react";
import { FosaBar } from "./AdminAgenda";
import AdminVisit from "./AdminVisit";

type Pub = "LIBRE" | "OCUPADO" | "CERRADO";
type Garage = { mode: "auto" | "open" | "closed"; busy: boolean; busyUntil?: string | null; public: Pub };
type Item = { id: string; time: string; duration: number; name: string; socio: boolean; vehicle: "carro" | "camioneta" | null; status: string; seal: string; secondsLeft: number; doneBy: string | null; member: string | null };

const pad = (n: number) => String(n).padStart(2, "0");
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const range = (t: string, d: number) => { const a = toMin(t), f = (x: number) => `${Math.floor(x / 60) % 12 || 12}:${pad(x % 60)}`; return `${f(a)}–${f(a + d)}`; };
const nowMin = () => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()).split(":").map(Number); return p[0] * 60 + p[1]; };

/**
 * "Hoy": lo único que necesita el empleado. Arriba el garage (abrir/cerrar, libre/ocupado);
 * abajo quién viene hoy con su sello vivo: si coincide con el celular del cliente, es real.
 */
export default function AdminToday({ onUnauthorized, onMsg }: { onUnauthorized: () => void; onMsg: (m: string) => void }) {
  const [g, setG] = useState<Garage | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [mins, setMins] = useState(nowMin());

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/today", { cache: "no-store" });
    if (r.status === 401) return onUnauthorized();
    if (!r.ok) return;
    const d = await r.json();
    setG(d.garage); setItems(d.items); setMins(nowMin());
  }, [onUnauthorized]);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  async function setGarage(patch: { mode?: Garage["mode"]; busy?: boolean; minutes?: 20 | 30 }) {
    setBusy(true);
    const r = await fetch("/api/admin/garage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    setBusy(false);
    if (r.status === 401) return onUnauthorized();
    onMsg(r.ok ? "Listo. La página se actualiza en segundos." : "No se pudo cambiar. Intenta de nuevo.");
    load();
  }

  async function seal(id: string) {
    if (!confirm("¿Sellar esta lavada como hecha? No se puede deshacer.")) return;
    setBusy(true);
    const r = await fetch("/api/admin/today/seal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    setBusy(false);
    if (r.status === 401) return onUnauthorized();
    const d = await r.json().catch(() => ({}));
    onMsg(r.ok ? "Lavada sellada. Queda en el historial." : d.error ?? "No se pudo sellar.");
    load();
  }

  const pub = g?.public ?? null;
  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-white/10 bg-white/[.03] p-4">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-white/55">Negocio hoy</p>
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Negocio">
          {([["auto", "Automático"], ["open", "Abrir hoy"], ["closed", "Cerrar hoy"]] as const).map(([m, t]) => (
            <button key={m} role="radio" aria-checked={g?.mode === m} disabled={busy} onClick={() => setGarage({ mode: m })}
              className={`min-h-14 rounded-2xl border-2 text-base font-bold disabled:opacity-50 ${g?.mode === m ? "border-gold bg-gold text-ink" : "border-white/12 text-white/80"}`}>{t}</button>
          ))}
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[.22em] text-white/55">Lugar de lavado</p>
        <div className="mt-2">
          <FosaBar pub={pub ?? "CERRADO"} busyUntil={g?.busyUntil ?? null} disabled={busy}
            onFosa={(busyNow, minutes) => setGarage(busyNow ? { busy: true, minutes: minutes ?? 30 } : { busy: false })} />
        </div>
      </section>

      <AdminVisit onUnauthorized={onUnauthorized} onDone={load} />

      <section>
        <h2 className="text-lg font-bold">Hoy vienen <span className="num text-gold">{items?.length ?? 0}</span></h2>
        {items === null ? <p className="mt-3 text-white/60">Cargando…</p> : items.length === 0 ? <p className="mt-3 rounded-2xl bg-white/[.04] p-4 text-white/70">Nadie ha apartado para hoy.</p> : (
          <ul className="mt-3 grid gap-2">
            {items.map((b) => {
              const end = toMin(b.time) + b.duration, past = end <= mins, nowOn = toMin(b.time) <= mins && mins < end;
              return (
                <li key={b.id} className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3 ${nowOn ? "border-gold bg-gold/10" : past ? "border-white/5 bg-white/[.02] text-white/45" : "border-white/10 bg-white/[.04]"}`}>
                  <span className="num w-[5.5rem] text-lg font-bold">{range(b.time, b.duration)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-bold">{b.name}</span>
                    <span className="block text-sm text-white/65">
                      <span className={`mr-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${b.socio ? "bg-gold/20 text-gold" : "bg-white/10 text-white/80"}`}>{b.socio ? "Socio" : b.status === "confirmed" ? "Pagada" : b.status === "pending" ? "Pago en revisión" : "Normal"}</span>
                      {b.vehicle === "camioneta" ? "Camioneta" : b.vehicle === "carro" ? "Carro" : ""}
                    </span>
                  </span>
                  <span className="text-center">
                    <span className="num block rounded-xl bg-black px-3 py-1 text-2xl font-bold tracking-[.2em] text-white" aria-label={`Sello ${b.seal}`}>{b.seal}</span>
                    <span className="block text-[10px] text-white/45">sello</span>
                  </span>
                  <span className="col-span-3">
                    {b.status === "done" ? <span className="block rounded-xl bg-emerald-500/15 py-2.5 text-center text-base font-semibold text-emerald-300">✓ Sellada{b.doneBy ? ` · ${b.doneBy}` : ""}</span>
                      : b.status === "confirmed" ? <button type="button" disabled={busy} onClick={() => seal(b.id)} className="min-h-12 w-full rounded-xl bg-gold text-base font-bold text-ink active:scale-[.98] disabled:opacity-50">Sellar lavada{b.member ? ` · ${b.member}` : ""}</button>
                      : <span className="block py-1 text-center text-sm text-white/50">Sin pago confirmado: no sellar</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-sm text-white/50">Pide su pantalla: si los 3 números coinciden y el reloj corre, es real. Después toca "Sellar lavada". Si no está en la lista, no tiene turno.</p>
      </section>
    </div>
  );
}
