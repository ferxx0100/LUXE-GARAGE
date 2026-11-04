"use client";
import { useCallback, useEffect, useState } from "react";

type St = { id: string; name: string; active: boolean; createdAt: string };
type Ev = { at: string; who: string; action: string; detail: string };
const when = (iso: string) => new Date(iso).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const monthNow = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit" }).format(new Date());

/** Equipo (solo el dueño): empleados con PIN propio, movimientos de todos y exportar reservas. */
export default function AdminTeam({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [staff, setStaff] = useState<St[] | null>(null);
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [name, setName] = useState("");
  const [shown, setShown] = useState<{ name: string; pin: string } | null>(null);
  const [err, setErr] = useState("");
  const [month, setMonth] = useState(monthNow());

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([fetch("/api/admin/staff", { cache: "no-store" }), fetch("/api/admin/audit", { cache: "no-store" })]);
    if (a.status === 401 || b.status === 401) return onUnauthorized();
    if (a.ok) setStaff((await a.json()).staff);
    if (b.ok) setEvents((await b.json()).items);
  }, [onUnauthorized]);
  useEffect(() => { load(); }, [load]);

  async function post(body: unknown) {
    setErr("");
    const r = await fetch("/api/admin/staff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (r.status === 401) return onUnauthorized();
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(d.error ?? "No se pudo.");
    if (d.pin) setShown({ name: d.staff.name, pin: d.pin });
    load();
  }

  return (
    <div className="grid gap-8">
      <section>
        <h2 className="text-lg font-bold">Empleados</h2>
        <p className="mt-1 text-sm text-white/55">Cada uno entra con su PIN. Solo ve "Hoy": abrir/cerrar, libre/ocupado y sellar lavadas.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) { post({ op: "add", name }); setName(""); } }} className="mt-3 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del empleado" maxLength={40}
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-4 text-base outline-none focus:border-gold" />
          <button className="min-h-12 shrink-0 rounded-xl bg-gold px-4 font-bold text-ink disabled:opacity-50" disabled={name.trim().length < 2}>Dar de alta</button>
        </form>
        {err && <p role="alert" className="mt-2 text-sm text-red-300">{err}</p>}
        {shown && (
          <div className="mt-3 rounded-2xl border border-gold/50 bg-gold/10 p-4 text-center">
            <p className="text-sm text-white/75">PIN de {shown.name}. Dáselo ahora: no se vuelve a mostrar.</p>
            <p className="num mt-1 text-4xl font-bold tracking-[.3em] text-gold">{shown.pin}</p>
            <button type="button" onClick={() => setShown(null)} className="mt-2 text-sm text-white/60 underline">Ya lo anoté</button>
          </div>
        )}
        <ul className="mt-3 grid gap-2">
          {staff?.length === 0 && <li className="rounded-2xl bg-white/[.04] p-4 text-white/60">Aún no hay empleados.</li>}
          {staff?.map((s) => (
            <li key={s.id} className={`flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3 ${s.active ? "bg-white/[.04]" : "opacity-50"}`}>
              <span className="min-w-0"><span className="block truncate font-semibold">{s.name}</span><span className="text-sm text-white/55">{s.active ? "Activo" : "De baja"}</span></span>
              <span className="flex shrink-0 gap-2">
                <button type="button" onClick={() => post({ op: "pin", id: s.id })} className="min-h-11 rounded-xl border border-white/15 px-3 text-sm">PIN nuevo</button>
                <button type="button" onClick={() => post({ op: "active", id: s.id, active: !s.active })} className="min-h-11 rounded-xl border border-white/15 px-3 text-sm">{s.active ? "Dar de baja" : "Reactivar"}</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold">Exportar reservas</h2>
        <div className="mt-3 flex gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-4 text-base" aria-label="Mes" />
          <a href={`/api/admin/export?mes=${month}`} className="grid min-h-12 shrink-0 place-items-center rounded-xl bg-gold px-4 font-bold text-ink">Descargar Excel</a>
        </div>
        <p className="mt-2 text-sm text-white/55">Fecha, cliente, socio o lavada normal, monto, pago de Mercado Pago y quién selló.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold">Movimientos</h2>
        <p className="mt-1 text-sm text-white/55">Todo lo que se hace en el panel, con nombre y hora. No se puede borrar.</p>
        <ul className="mt-3 divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[.03]">
          {events === null ? <li className="p-4 text-white/60">Cargando…</li> : events.length === 0 ? <li className="p-4 text-white/60">Sin movimientos todavía.</li> : events.map((e, i) => (
            <li key={i} className="grid grid-cols-[auto_1fr] gap-x-3 px-4 py-2.5 text-sm">
              <span className="num text-white/50">{when(e.at)}</span>
              <span><b className="font-semibold">{e.who}</b> · {e.action}{e.detail ? <span className="text-white/55"> · {e.detail}</span> : null}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
