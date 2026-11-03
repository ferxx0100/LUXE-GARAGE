"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Status = "hold" | "pending" | "confirmed" | "done" | "cancelled" | "conflict";
interface Booking {
  id: string; code: string; status: Status; date: string; time: string;
  vehicle: "carro" | "camioneta"; kind: "exterior" | "interior"; place: "garage" | "domicilio"; address: string;
  name: string; phone: string; email: string; plate: string; notes: string; amount: number; paymentId?: string;
}

const DAY = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const wd = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
const mxToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const CHIP: Record<Status, { t: string; c: string }> = {
  confirmed: { t: "Pagada", c: "bg-emerald-500/20 text-emerald-300 border-emerald-400/50" },
  pending: { t: "Pago en revisión", c: "bg-amber-500/20 text-amber-200 border-amber-400/50" },
  hold: { t: "Sin pagar", c: "bg-zinc-500/20 text-zinc-300 border-zinc-400/40" },
  done: { t: "Completada", c: "bg-gold/20 text-gold border-gold/50" },
  cancelled: { t: "Cancelada", c: "bg-zinc-700/40 text-zinc-400 border-zinc-500/40" },
  conflict: { t: "⚠ Pagada sin horario", c: "bg-red-500/20 text-red-200 border-red-400/60" },
};

export default function AdminAgenda({ onUnauthorized, onMsg }: { onUnauthorized: () => void; onMsg: (m: string) => void }) {
  const [today, setToday] = useState(mxToday);
  const [day, setDay] = useState(today);
  const [list, setList] = useState<Booking[] | null>(null);
  const [q, setQ] = useState("");
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i)), [today]);

  const load = useCallback(async () => {
    const t = mxToday();
    setToday(t);
    const r = await fetch(`/api/admin/bookings?from=${addDays(t, -7)}&days=21`, { cache: "no-store" });
    if (r.status === 401) return onUnauthorized();
    if (r.ok) setList((await r.json()).bookings);
  }, [onUnauthorized]);

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  async function act(b: Booking, action: "done" | "cancel" | "confirm") {
    if (action === "cancel" && !confirm(`¿Cancelar la cita de ${b.name} (${b.time})? El horario queda libre. Si ya pagó, haz el reembolso en Mercado Pago.`)) return;
    const r = await fetch(`/api/admin/bookings/${b.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    if (r.status === 401) return onUnauthorized();
    onMsg(r.ok ? "Listo." : "No se pudo actualizar.");
    load();
  }

  const all = list ?? [];
  const needle = q.trim().toLowerCase().replace(/\s+/g, "");
  const found = needle.length >= 3
    ? all.filter((b) => [b.code, b.name, b.phone, b.plate].some((v) => v.toLowerCase().replace(/\s+/g, "").includes(needle))).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    : null;
  const ofDay = found ?? all.filter((b) => b.date === day).sort((a, b) => a.time.localeCompare(b.time));
  const active = (b: Booking) => ["confirmed", "done", "pending", "conflict"].includes(b.status);
  const countFor = (d: string) => all.filter((b) => b.date === d && active(b)).length;
  const dayActive = ofDay.filter(active);
  const cobrado = dayActive.filter((b) => b.status !== "pending").reduce((s, b) => s + b.amount, 0);
  const domicilio = dayActive.filter((b) => b.place === "domicilio").length;
  const alerts = all.filter((b) => b.status === "conflict");

  return (
    <div>
      {alerts.length > 0 && (
        <p className="mb-4 rounded-2xl border border-red-400/60 bg-red-500/15 p-4 text-base text-red-100">
          ⚠ {alerts.length} pago(s) llegaron cuando el horario ya estaba ocupado. Contacta al cliente para reagendar o reembolsar.
        </p>
      )}

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Buscar por código, nombre, teléfono o placas"
        className="mb-4 w-full rounded-xl border-2 border-white/12 bg-white/[.04] px-4 py-3.5 text-lg outline-none placeholder:text-white/45 focus:border-gold" aria-label="Buscar cita" />
      {found && <p className="mb-3 text-base text-white/75">{found.length} resultado(s) para “{q}” (últimos 7 días y próximas 2 semanas)</p>}

      <div className={`-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] ${found ? "hidden" : ""}`}>
        {days.map((d, i) => {
          const n = countFor(d), on = d === day;
          return (
            <button key={d} onClick={() => setDay(d)} aria-pressed={on}
              className={`relative flex min-w-[74px] flex-col items-center rounded-2xl border-2 px-3 py-2.5 ${on ? "border-gold bg-gold text-ink" : "border-white/12 bg-white/[.04]"}`}>
              <span className="text-sm font-semibold">{i === 0 ? "Hoy" : i === 1 ? "Mañana" : DAY[wd(d)]}</span>
              <span className="font-display text-2xl font-semibold">{Number(d.slice(8))}</span>
              <span className="text-xs uppercase">{MONTH[Number(d.slice(5, 7)) - 1]}</span>
              {n > 0 && <span className={`absolute -right-1 -top-1 grid size-6 place-items-center rounded-full text-xs font-bold ${on ? "bg-ink text-gold" : "bg-gold text-ink"}`}>{n}</span>}
            </button>
          );
        })}
      </div>

      <div className={`mt-5 grid grid-cols-3 gap-3 ${found ? "hidden" : ""}`}>
        {[["Citas", String(dayActive.length)], ["Cobrado", `$${cobrado}`], ["Domicilio", String(domicilio)]].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[.06] to-transparent p-4">
            <p className="text-sm text-white/65">{k}</p>
            <p className="font-display mt-1 text-3xl font-semibold text-gold">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4">
        {list === null && <p className="text-lg text-white/70">Cargando citas…</p>}
        {list !== null && ofDay.length === 0 && (
          <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-lg text-white/70">Sin citas este día.</p>
        )}
        {ofDay.map((b) => {
          const chip = CHIP[b.status];
          const wa = `https://wa.me/${b.phone.length === 10 ? `52${b.phone}` : b.phone}?text=${encodeURIComponent(`Hola ${b.name.split(" ")[0]}, te escribimos de LUXE GARAGE por tu cita ${b.code} (${b.time}).`)}`;
          return (
            <article key={b.id} className={`overflow-hidden rounded-3xl border bg-white/[.03] ${b.status === "cancelled" ? "border-white/5 opacity-60" : "border-white/12"}`}>
              <div className="flex items-stretch">
                <div className={`flex w-24 shrink-0 flex-col items-center justify-center gap-1 ${b.place === "domicilio" ? "bg-sky-500/15" : "bg-gold/10"}`}>
                  {found && <span className="text-xs font-bold">{DAY[wd(b.date)]} {Number(b.date.slice(8))} {MONTH[Number(b.date.slice(5, 7)) - 1]}</span>}
                  <span className="font-display text-3xl font-semibold">{b.time}</span>
                  <span className="text-xs font-bold tracking-wider text-white/70">{b.place === "domicilio" ? "DOMICILIO" : "GARAGE"}</span>
                </div>
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${chip.c}`}>{chip.t}</span>
                    <span className="text-sm text-white/55">{b.code}</span>
                  </div>
                  <p className="mt-1.5 truncate text-xl font-bold">{b.name}</p>
                  <p className="text-base text-white/80">
                    {b.vehicle === "carro" ? "Carro" : "Camioneta"} · {b.kind === "exterior" ? "Exterior" : "Interior"}{b.plate ? ` · ${b.plate}` : ""} · <b className="text-gold">${b.amount}</b>
                  </p>
                  {b.place === "domicilio" && <p className="mt-1 text-base text-sky-200">📍 {b.address}</p>}
                  {b.notes && <p className="mt-1 text-sm italic text-white/65">“{b.notes}”</p>}
                </div>
              </div>
              <div className="grid grid-cols-4 border-t border-white/10 text-sm font-semibold">
                <a href={`tel:+${b.phone.length === 10 ? `52${b.phone}` : b.phone}`} className="py-3 text-center hover:bg-white/5">📞 Llamar</a>
                <a href={wa} target="_blank" rel="noopener noreferrer" className="border-l border-white/10 py-3 text-center hover:bg-white/5">💬 WhatsApp</a>
                {b.status === "done" || b.status === "cancelled" ? (
                  <span className="col-span-2 border-l border-white/10 py-3 text-center text-white/45">{b.status === "done" ? "Completada" : "Cancelada"}</span>
                ) : (
                  <>
                    <button onClick={() => act(b, b.status === "pending" ? "confirm" : "done")} className="border-l border-white/10 py-3 text-emerald-300 hover:bg-white/5">
                      {b.status === "pending" ? "✓ Confirmar" : "✓ Completada"}
                    </button>
                    <button onClick={() => act(b, "cancel")} className="border-l border-white/10 py-3 text-red-300 hover:bg-white/5">✕ Cancelar</button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {all.length > 0 && !found && <Clients list={all.filter((b) => active(b) && b.date >= today)} />}
    </div>
  );
}

// Clientes de las próximas 2 semanas, agrupados por teléfono.
function Clients({ list }: { list: Booking[] }) {
  const map = new Map<string, { name: string; phone: string; n: number; total: number; next: string }>();
  for (const b of list) {
    const c = map.get(b.phone) ?? { name: b.name, phone: b.phone, n: 0, total: 0, next: `${b.date} ${b.time}` };
    c.n++; c.total += b.amount; if (`${b.date} ${b.time}` < c.next) c.next = `${b.date} ${b.time}`;
    map.set(b.phone, c);
  }
  const rows = [...map.values()].sort((a, b) => a.next.localeCompare(b.next));
  return (
    <section className="mt-10">
      <h2 className="text-sm tracking-[.3em] text-white/60">CLIENTES CON CITA</h2>
      <div className="mt-3 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
        {rows.map((c) => (
          <div key={c.phone} className="flex items-center justify-between gap-3 bg-white/[.02] px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{c.name}</p>
              <p className="text-sm text-white/65">{c.phone} · próxima {c.next.slice(5).replace("-", "/")}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-xl text-gold">${c.total}</p>
              <p className="text-xs text-white/60">{c.n} cita{c.n > 1 ? "s" : ""}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
