"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Status = "hold" | "pending" | "confirmed" | "done" | "cancelled" | "conflict";
interface Booking {
  id: string; code: string; status: Status; date: string; time: string;
  vehicle: "carro" | "camioneta"; kind: "completo" | "exterior" | "interior"; place: "garage" | "domicilio"; address: string;
  name: string; phone: string; email?: string; plate?: string; notes?: string; amount: number; paymentId?: string;
  duration?: number; membershipId?: string; membershipCode?: string;
}

const DAY = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTH = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const wd = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
const mxToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dayLabel = (d: string) => `${DAY_LONG[wd(d)]} ${Number(d.slice(8))} ${MONTH[Number(d.slice(5, 7)) - 1]}`;

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const parts12 = (m: number) => { const h = Math.floor(m / 60) % 24, mm = m % 60; return { t: `${h % 12 || 12}:${String(mm).padStart(2, "0")}`, ap: h < 12 ? "am" : "pm" }; };
/** "16:30" → "4:30 pm" */
export const fmt12 = (t: string) => { const p = parts12(toMin(t)); return `${p.t} ${p.ap}`; };
/** "16:00", 30 → "4:00 – 4:30 pm" */
const range12 = (t: string, dur: number) => {
  const a = parts12(toMin(t)), b = parts12(toMin(t) + dur);
  return a.ap === b.ap ? `${a.t} – ${b.t} ${b.ap}` : `${a.t} ${a.ap} – ${b.t} ${b.ap}`;
};
const durOf = (b: Booking) => b.duration ?? (b.kind === "exterior" ? 20 : 30);
const fosaMin = (d: number): 20 | 30 => (d <= 20 ? 20 : 30);

const CHIP: Record<Status, { t: string; c: string }> = {
  confirmed: { t: "Pagada", c: "bg-gold/20 text-gold-hi border-gold/50" },
  pending: { t: "Pago en revisión", c: "bg-gold/20 text-gold-hi border-gold/50" },
  hold: { t: "Sin pagar", c: "bg-white/10 text-white/80 border-white/30" },
  done: { t: "Usada", c: "bg-gold/20 text-gold border-gold/50" },
  cancelled: { t: "Cancelada", c: "bg-white/5 text-white/50 border-white/20" },
  conflict: { t: "⚠ Pagada sin horario", c: "bg-red-500/20 text-red-200 border-red-400/60" },
};
const MEMBER = "bg-gold/15 text-gold-hi border-gold/50";

type Pub = "LIBRE" | "OCUPADO" | "CERRADO";
export default function AdminAgenda({ onUnauthorized, onMsg, pub, busyUntil, onFosa }: {
  onUnauthorized: () => void; onMsg: (m: string) => void; pub: Pub | null; busyUntil?: string | null;
  onFosa: (busy: boolean, minutes?: 20 | 30) => Promise<void> | void;
}) {
  const [today, setToday] = useState(mxToday);
  const [day, setDay] = useState(today);
  const [list, setList] = useState<Booking[] | null>(null);
  const [q, setQ] = useState("");
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i)), [today]);

  const load = useCallback(async () => {
    const t = mxToday();
    setToday(t);
    const r = await fetch(`/api/admin/bookings?from=${addDays(t, -7)}&days=31`, { cache: "no-store" });
    if (r.status === 401) return onUnauthorized();
    if (r.ok) setList((await r.json()).bookings);
  }, [onUnauthorized]);

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  // Conectado con el semáforo: "Llegó" pone la fosa en Ocupado por la duración del servicio; "Terminado" la completa y la deja Libre.
  async function arrived(b: Booking) { await onFosa(true, fosaMin(durOf(b))); onMsg(`${b.name.split(" ")[0]} llegó · semáforo en OCUPADO`); }
  async function finished(b: Booking) {
    await act(b, "done");
    if (b.place === "garage" && b.date === today) { await onFosa(false); onMsg("Terminado · semáforo en LIBRE"); }
  }

  async function act(b: Booking, action: "done" | "cancel" | "confirm") {
    if (action === "cancel" && !confirm(`¿Cancelar la cita de ${b.name} (${fmt12(b.time)})? El horario queda libre.${b.membershipId ? "" : " Si ya pagó, haz el reembolso en Mercado Pago."}`)) return;
    const r = await fetch(`/api/admin/bookings/${b.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    if (r.status === 401) return onUnauthorized();
    onMsg(r.ok ? "Listo." : "No se pudo actualizar.");
    load();
  }

  const all = list ?? [];
  const needle = q.trim().toLowerCase().replace(/\s+/g, "");
  const found = needle.length >= 3
    ? all.filter((b) => [b.code, b.name, b.phone, b.plate ?? "", b.membershipCode ?? ""].some((v) => v.toLowerCase().replace(/\s+/g, "").includes(needle)))
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    : null;
  const ofDay = found ?? all.filter((b) => b.date === day).sort((a, b) => a.time.localeCompare(b.time));
  const active = (b: Booking) => ["confirmed", "done", "pending", "conflict"].includes(b.status);
  const countFor = (d: string) => all.filter((b) => b.date === d && active(b)).length;
  const dayActive = ofDay.filter(active);
  const cobrado = dayActive.filter((b) => b.status !== "pending" && !b.membershipId).reduce((s, b) => s + b.amount, 0);
  const domicilio = dayActive.filter((b) => b.place === "domicilio").length;
  const miembros = dayActive.filter((b) => b.membershipId).length;
  const alerts = all.filter((b) => b.status === "conflict");

  return (
    <div className="min-w-0">
      <VerifyReceipt onUnauthorized={onUnauthorized} onMsg={onMsg} onChanged={load} />

      {alerts.length > 0 && (
        <p className="mb-4 rounded-2xl border border-red-400/60 bg-red-500/15 p-4 text-base text-red-100">
          ⚠ {alerts.length} pago(s) llegaron cuando el horario ya estaba ocupado. Contacta al cliente para reagendar o reembolsar.
        </p>
      )}

      <FosaBar pub={pub} busyUntil={busyUntil ?? null} onFosa={onFosa} />

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Buscar código, nombre o teléfono" enterKeyHint="search"
        className="mb-4 w-full rounded-2xl border-2 border-white/12 bg-white/[.04] px-4 py-4 text-lg outline-none placeholder:text-white/45 focus:border-gold" aria-label="Buscar cita" />
      {found && <p className="mb-3 text-base text-white/75">{found.length} resultado(s) para “{q}”</p>}

      <div className={`-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] ${found ? "hidden" : ""}`}>
        {days.map((d, i) => {
          const n = countFor(d), on = d === day;
          return (
            <button key={d} onClick={() => setDay(d)} aria-pressed={on}
              className={`relative flex min-w-[74px] snap-start flex-col items-center rounded-2xl border-2 px-3 py-2.5 transition active:scale-95 ${on ? "border-gold bg-gold text-ink shadow-[0_6px_24px_-6px_rgba(212,175,55,.7)]" : "border-white/12 bg-white/[.04]"}`}>
              <span className="text-sm font-semibold">{i === 0 ? "Hoy" : i === 1 ? "Mañana" : DAY[wd(d)]}</span>
              <span className="font-display text-2xl font-semibold">{Number(d.slice(8))}</span>
              <span className="text-xs uppercase">{MONTH[Number(d.slice(5, 7)) - 1]}</span>
              {n > 0 && <span className={`absolute -right-1 -top-1 grid size-6 place-items-center rounded-full text-xs font-bold ${on ? "bg-ink text-gold" : "bg-gold text-ink"}`}>{n}</span>}
            </button>
          );
        })}
      </div>

      <div className={`mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 ${found ? "hidden" : ""}`}>
        {([["Citas", String(dayActive.length), "text-gold"], ["Cobrado", `$${cobrado}`, "text-gold"], ["Domicilio", String(domicilio), "text-gold"], ["Miembros", String(miembros), "text-gold"]] as const).map(([k, v, c]) => (
          <div key={k} className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[.07] to-transparent p-4">
            <p className="text-sm text-white/65">{k}</p>
            <p className={`font-display mt-1 text-3xl font-semibold ${c}`}>{v}</p>
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
          const dur = durOf(b);
          const start = parts12(toMin(b.time));
          const tel = b.phone.length === 10 ? `52${b.phone}` : b.phone;
          const wa = `https://wa.me/${tel}?text=${encodeURIComponent(`Hola ${b.name.split(" ")[0]}, te escribimos de LUXE GARAGE por tu cita ${b.code} (${fmt12(b.time)}).`)}`;
          const here = b.date === today && b.place === "garage";
          return (
            <article key={b.id} className={`overflow-hidden rounded-3xl border bg-white/[.03] ${b.status === "cancelled" ? "border-white/5 opacity-60" : b.membershipId ? "border-gold/30" : "border-white/12"}`}>
              <div className="flex items-stretch">
                <div className={`flex w-[5.5rem] shrink-0 flex-col items-center justify-center gap-0.5 px-1 py-3 ${b.place === "domicilio" ? "bg-gold/15" : b.membershipId ? "bg-gold/10" : "bg-gold/10"}`}>
                  {found && <span className="text-xs font-bold">{DAY[wd(b.date)]} {Number(b.date.slice(8))} {MONTH[Number(b.date.slice(5, 7)) - 1]}</span>}
                  <span className="font-display text-[1.7rem] font-semibold leading-none">{start.t}</span>
                  <span className="text-sm font-bold uppercase text-white/75">{start.ap}</span>
                  <span className="mt-1 text-[11px] font-bold tracking-wider text-white/60">{b.place === "domicilio" ? "DOMICILIO" : "GARAGE"}</span>
                </div>
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${chip.c}`}>{chip.t}</span>
                    {b.membershipId && <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${MEMBER}`}>Membresía {b.membershipCode ?? ""}</span>}
                    {!b.membershipId && <span className="text-sm text-white/55">{b.code}</span>}
                  </div>
                  <p className="mt-1.5 truncate text-xl font-bold">{b.name}</p>
                  <p className="text-base font-semibold text-white/90">🕓 {range12(b.time, dur)} <span className="font-normal text-white/55">· {dur} min</span></p>
                  <p className="text-base text-white/75">
                    {b.vehicle === "carro" ? "Carro" : "Camioneta"} · {b.kind === "exterior" ? "Solo exterior" : "Ext. e interior"}{b.plate ? ` · ${b.plate}` : ""} ·{" "}
                    {b.membershipId ? <b className="text-gold">Incluido</b> : <b className="text-gold">${b.amount}</b>}
                  </p>
                  {b.place === "domicilio" && <p className="mt-1 break-words text-base text-gold-hi">📍 {b.address}</p>}
                  {b.notes && <p className="mt-1 break-words text-sm italic text-white/65">“{b.notes}”</p>}
                </div>
              </div>
              <div className="grid grid-cols-4 border-t border-white/10 text-sm font-semibold">
                <a href={`tel:+${tel}`} className="flex min-h-14 flex-col items-center justify-center gap-0.5 active:bg-white/10"><span className="text-lg leading-none">📞</span>Llamar</a>
                <a href={wa} target="_blank" rel="noopener noreferrer" className="flex min-h-14 flex-col items-center justify-center gap-0.5 border-l border-white/10 active:bg-white/10"><span className="text-lg leading-none">💬</span>WhatsApp</a>
                {b.status === "done" || b.status === "cancelled" ? (
                  <span className="col-span-2 flex min-h-14 items-center justify-center border-l border-white/10 text-white/45">{b.status === "done" ? "Completada" : "Cancelada"}</span>
                ) : (
                  <>
                    {b.status === "pending" ? (
                      <Act onClick={() => act(b, "confirm")} icon="✓" t="Confirmar" c="text-gold" />
                    ) : here && pub === "LIBRE" ? (
                      <Act onClick={() => arrived(b)} icon="🚗" t="Llegó" c="bg-gold/10 text-gold" />
                    ) : (
                      <Act onClick={() => finished(b)} icon="✓" t="Terminado" c="text-gold" />
                    )}
                    <Act onClick={() => act(b, "cancel")} icon="✕" t="Cancelar" c="text-red-300" />
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

function Act({ onClick, icon, t, c }: { onClick: () => void; icon: string; t: string; c: string }) {
  return (
    <button onClick={onClick} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 border-l border-white/10 active:bg-white/10 ${c}`}>
      <span className="text-lg leading-none">{icon}</span>{t}
    </button>
  );
}

/** Barra del semáforo: Libre → dos botones de Ocupado (30 / 20 min); Ocupado → hora estimada + "Ya está libre". */
export function FosaBar({ pub, busyUntil, onFosa, disabled }: {
  pub: Pub | null; busyUntil: string | null; disabled?: boolean; onFosa: (busy: boolean, minutes?: 20 | 30) => Promise<void> | void;
}) {
  const tone = pub === "LIBRE" ? "border-emerald-400/50 bg-emerald-500/10" : pub === "OCUPADO" ? "border-red-400/50 bg-red-500/10" : "border-gold/40 bg-gold/[.07]";
  const dot = pub === "LIBRE" ? "bg-emerald-400 text-emerald-400" : pub === "OCUPADO" ? "bg-red-500 text-red-500" : "bg-gold text-gold";
  return (
    <div className={`mb-4 rounded-3xl border p-4 ${tone}`}>
      <div className="flex items-center gap-3">
        <span className={`size-4 shrink-0 animate-pulse rounded-full shadow-[0_0_14px_currentColor] ${dot}`} />
        <div className="min-w-0">
          <p className="text-xs tracking-[.25em] text-white/60">SEMÁFORO</p>
          <p className="font-display text-2xl font-semibold leading-tight">{pub ?? "…"}</p>
        </div>
        {pub === "OCUPADO" && busyUntil && (
          <p className="ml-auto text-right text-base leading-tight text-white/85">Se desocupa aprox.<br /><b className="font-display text-xl text-white">{fmt12(busyUntil)}</b></p>
        )}
      </div>
      {pub === "LIBRE" && (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {([[30, "Ext. e interior", "30 min"], [20, "Solo exterior", "20 min"]] as const).map(([m, t, d]) => (
            <button key={m} disabled={disabled} onClick={() => onFosa(true, m)}
              className="flex min-h-16 items-center justify-between gap-3 rounded-2xl bg-red-500 px-4 py-3 text-left text-white shadow-[0_8px_24px_-10px_rgba(239,68,68,.9)] transition active:scale-[.98] disabled:opacity-50">
              <span><span className="block text-xs font-bold tracking-[.2em] opacity-80">OCUPADO</span><span className="block text-lg font-bold leading-tight">{t}</span></span>
              <span className="rounded-full bg-black/25 px-3 py-1 text-base font-bold">{d}</span>
            </button>
          ))}
        </div>
      )}
      {pub === "OCUPADO" && (
        <button disabled={disabled} onClick={() => onFosa(false)}
          className="mt-3 min-h-16 w-full rounded-2xl bg-gold px-4 py-3 text-xl font-bold text-ink shadow-[0_8px_24px_-10px_rgba(212,175,55,.9)] transition active:scale-[.98] disabled:opacity-50">
          ✓ Ya está libre
        </button>
      )}
      {pub === "CERRADO" && <p className="mt-2 text-sm text-white/60">Cerrado. Para cambiar el lugar abre el negocio en la pestaña Garage.</p>}
    </div>
  );
}

// ——— Verificar recibo ———
type Verify = {
  kind: "booking" | "membership"; id: string; code?: string; status: Status; name: string; phoneLast4: string;
  date: string | null; time: string | null; duration?: number; seal: string; secondsLeft: number; validTo?: string;
  washes?: { id: string; date: string; time: string; status: Status }[];
};

function VerifyReceipt({ onUnauthorized, onMsg, onChanged }: { onUnauthorized: () => void; onMsg: (m: string) => void; onChanged: () => void }) {
  const [code, setCode] = useState("");
  const [res, setRes] = useState<Verify | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [left, setLeft] = useState(0);
  const asked = useRef("");

  const fetchCode = useCallback(async (c: string, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const r = await fetch(`/api/admin/verify?code=${encodeURIComponent(c)}`, { cache: "no-store" });
      if (r.status === 401) return onUnauthorized();
      const d = await r.json().catch(() => ({}));
      if (asked.current !== c) return;
      if (r.ok) { setRes(d as Verify); setLeft((d as Verify).secondsLeft); setErr(""); }
      else if (!quiet) { setRes(null); setErr(r.status === 404 ? "No existe ningún recibo con ese código. Puede ser falso." : d.error ?? "No se pudo verificar."); }
    } catch { if (!quiet) setErr("Sin conexión. Intenta de nuevo."); }
    finally { if (!quiet) setLoading(false); }
  }, [onUnauthorized]);

  // Sello vivo: refresca cada 5 s mientras hay un recibo abierto; el contador baja cada segundo.
  useEffect(() => {
    if (!res) return;
    const c = asked.current;
    const poll = setInterval(() => fetchCode(c, true), 5000);
    const tick = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [res?.code, res?.id, fetchCode]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase().replace(/\s+/g, "");
    if (c.length < 4) return;
    asked.current = c;
    fetchCode(c);
  }
  function close() { asked.current = ""; setRes(null); setErr(""); setCode(""); }

  async function markUsed() {
    if (!res) return;
    const r = await fetch(`/api/admin/bookings/${res.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "done" }) });
    if (r.status === 401) return onUnauthorized();
    onMsg(r.ok ? "Marcado como usado." : "No se pudo marcar.");
    if (r.ok) { fetchCode(asked.current, true); onChanged(); }
  }

  const st = res ? CHIP[res.status] : null;
  const usable = res && (res.status === "confirmed" || res.status === "pending");
  return (
    <section className="mb-5 overflow-hidden rounded-3xl border border-gold/35 bg-gradient-to-br from-gold/[.12] via-white/[.03] to-transparent p-4">
      <p className="text-xs font-bold tracking-[.3em] text-gold">VERIFICAR RECIBO</p>
      <form onSubmit={submit} className="mt-2 flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="LG-XXXXXX" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
          enterKeyHint="go" aria-label="Código del recibo"
          className="min-w-0 flex-1 rounded-2xl border-2 border-white/15 bg-black/30 px-4 py-3.5 font-mono text-xl tracking-widest outline-none placeholder:text-white/30 focus:border-gold" />
        <button disabled={loading || code.trim().length < 4} className="btn-gold min-h-14 shrink-0 rounded-2xl px-5 text-lg font-bold disabled:opacity-50">{loading ? "…" : "Ver"}</button>
      </form>
      {err && <p className="mt-3 rounded-2xl border border-red-400/60 bg-red-500/15 p-3 text-base font-semibold text-red-100" role="alert">✕ {err}</p>}

      {res && st && (
        <div className="mt-4 grid gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-1.5">
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${st.c}`}>{st.t}</span>
                {res.kind === "membership" && <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${MEMBER}`}>Membresía</span>}
              </div>
              <p className="mt-1.5 break-words text-2xl font-bold">{res.name}</p>
              <p className="text-base text-white/75">Tel. termina en <b className="font-mono text-lg text-white">{res.phoneLast4}</b></p>
              {res.date && res.time && <p className="text-base text-white/75">{res.kind === "membership" ? "Lavada que toca: " : ""}<b className="text-white">{dayLabel(res.date)} · {range12(res.time, res.duration ?? 30)}</b></p>}
            </div>
            <button onClick={close} aria-label="Cerrar verificación" className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 text-xl text-white/70">✕</button>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="relative grid size-24 shrink-0 place-items-center">
              <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="6" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="#d4af37" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 45} strokeDashoffset={2 * Math.PI * 45 * (1 - Math.min(30, left) / 30)} style={{ transition: "stroke-dashoffset 1s linear" }} />
              </svg>
              <span className="font-display text-sm font-semibold text-white/70">{left}s</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white/65">Sello · debe coincidir con su pantalla</p>
              <p className="font-mono text-6xl font-bold tracking-[.15em] text-gold-grad" aria-live="polite">{res.seal}</p>
            </div>
          </div>

          {res.washes && res.washes.length > 0 && (
            <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
              {res.washes.map((w, i) => (
                <li key={w.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${w.id === res.id ? "bg-gold/10" : "bg-white/[.02]"}`}>
                  <span className="min-w-0 text-base"><b className="text-white/60">{i + 1}.</b> {dayLabel(w.date)} · {fmt12(w.time)}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold ${CHIP[w.status].c}`}>{CHIP[w.status].t}</span>
                </li>
              ))}
            </ul>
          )}

          {usable ? (
            <button onClick={markUsed} className="min-h-16 w-full rounded-2xl bg-gold text-xl font-bold text-ink transition active:scale-[.98]">✓ Marcar como usado</button>
          ) : (
            <p className={`rounded-2xl border p-3 text-center text-lg font-bold ${res.status === "done" ? "border-gold/50 bg-gold/10 text-gold" : "border-red-400/60 bg-red-500/15 text-red-100"}`}>
              {res.status === "done" ? "Ya se usó · no lo aceptes otra vez" : res.status === "cancelled" ? "Cancelado · no es válido" : "Sin pago confirmado · no es válido"}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// Clientes con cita (próximas semanas), agrupados por teléfono. Marca a los miembros.
function Clients({ list }: { list: Booking[] }) {
  const map = new Map<string, { name: string; phone: string; n: number; total: number; next: string; member: string | null }>();
  for (const b of list) {
    const c = map.get(b.phone) ?? { name: b.name, phone: b.phone, n: 0, total: 0, next: `${b.date} ${b.time}`, member: null };
    c.n++; if (!b.membershipId) c.total += b.amount; if (`${b.date} ${b.time}` < c.next) c.next = `${b.date} ${b.time}`;
    if (b.membershipId) c.member = b.membershipCode ?? "Miembro";
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
              <p className="flex items-center gap-2 text-lg font-bold"><span className="truncate">{c.name}</span>
                {c.member && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${MEMBER}`}>★ Miembro</span>}</p>
              <p className="text-sm text-white/65">{c.phone} · próxima {Number(c.next.slice(8, 10))} {MONTH[Number(c.next.slice(5, 7)) - 1]} {fmt12(c.next.slice(11))}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-xl text-gold">{c.total ? `$${c.total}` : "Incluido"}</p>
              <p className="text-xs text-white/60">{c.n} cita{c.n > 1 ? "s" : ""}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
