"use client";
import { useCallback, useEffect, useState } from "react";
import ReceiptSeal from "@/app/reserva/[id]/ReceiptSeal";
import JoinFlow from "./JoinFlow";
import { MpButton } from "./PayBrick";
import SlotPicker from "./SlotPicker";
import { addDays, DAY, MONTH, toMin, wd, vehicleLabel, WASH_MIN, type DayHours, type Vehicle } from "./fmt";

type Wash = { id: string; date: string; time: string; duration: number; past: boolean; canChange: boolean };
type Me = {
  member: { code: string; name: string; vehicle: Vehicle; status: "pending" | "active" | "cancelled" | "expired"; valid: boolean; processing?: boolean; periodStart: string | null; periodEnd: string | null; perPeriod: number; price: number };
  used: number; washes: Wash[];
};
type Seal = { status: string; seal: string; secondsLeft: number };

const field = "w-full min-h-16 rounded-2xl border-2 border-white/15 bg-black/30 px-5 text-lg text-white outline-none placeholder:text-white/40 focus:border-gold";
const pad = (n: number) => String(n).padStart(2, "0");
const range = (t: string, d: number) => { const a = toMin(t), b = a + d, f = (x: number) => `${Math.floor(x / 60) % 12 || 12}:${pad(x % 60)}`; return `${f(a)}–${f(b)}`; };
const shortDay = (d: string) => `${DAY[wd(d)].slice(0, 3)} ${Number(d.slice(8))} ${MONTH[Number(d.slice(5, 7)) - 1].slice(0, 3)}`;
const longDay = (d: string) => `${DAY[wd(d)].toLowerCase()} ${Number(d.slice(8))} de ${MONTH[Number(d.slice(5, 7)) - 1]}`;

async function post(url: string, body?: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}

/** Cuenta del socio: su tarjeta (sello vivo), sus lavadas del mes y apartar/cancelar. */
export default function SocioApp({ hours, prices, washesPerMonth, mpPublicKey, help }: {
  hours: DayHours[]; prices: Record<Vehicle, number>; washesPerMonth: number; mpPublicKey: string | null; help: string;
}) {
  const [me, setMe] = useState<Me | null | "out">(null);
  const [seal, setSeal] = useState<Seal | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState<{ date: string; time: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [libre, setLibre] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/socio/me", { cache: "no-store" });
    if (r.status === 401) { setMe("out"); return; }
    if (!r.ok) { setMsg({ ok: false, t: "No pudimos cargar tu cuenta. Revisa tu conexión." }); return; }
    setMe(await r.json());
    const s = await fetch("/api/socio/seal", { cache: "no-store" });
    if (s.ok) setSeal(await s.json());
  }, []);
  useEffect(() => { load(); }, [load]);
  // Mientras Mercado Pago confirma el primer cobro, la cuenta se revisa sola cada 25 s.
  const waiting = !!me && me !== "out" && me.member.status === "pending";
  useEffect(() => { if (!waiting) return; const t = setInterval(load, 25000); return () => clearInterval(t); }, [waiting, load]);

  // Si viene del letrero ("Apartar 4:30–5:00"), ya trae el turno elegido.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const d = q.get("d"), t = q.get("t");
    if (d && t && /^\d{4}-\d{2}-\d{2}$/.test(d) && /^\d{2}:\d{2}$/.test(t)) setPick({ date: d, time: t });
  }, []);

  // ¿Está libre ahorita? (para "Estoy aquí: lavar ahora")
  useEffect(() => {
    let alive = true;
    const f = () => fetch("/api/garage", { cache: "no-store" }).then((r) => r.json()).then((g) => alive && setLibre(g.status === "LIBRE")).catch(() => {});
    f();
    const t = setInterval(f, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (me === null) return <p className="py-20 text-center text-white/60">Cargando tu cuenta…</p>;
  if (me === "out") return <Login onDone={load} help={help} prices={prices} washes={washesPerMonth} mpPublicKey={mpPublicKey} />;

  const m = me.member;
  const left = Math.max(0, m.perPeriod - me.used);
  const lastDay = m.periodEnd ? addDays(m.periodEnd, -1) : null;
  const upcoming = me.washes.filter((w) => !w.past);
  const canBook = m.valid && left > 0;

  async function book(body: unknown) {
    setBusy(true); setMsg(null);
    const r = await post("/api/socio/book", body);
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, t: r.data.error ?? "No pudimos apartar." }); return; }
    setMsg({ ok: true, t: `Listo: ${longDay(r.data.date)}, ${range(r.data.time, 30)}.` });
    setPick(null); setPicking(false);
    window.history.replaceState(null, "", "/socio");
    load();
  }
  async function cancel(w: Wash) {
    if (!confirm(`¿Cancelar tu lavada del ${longDay(w.date)}, ${range(w.time, w.duration)}? Regresa a tus lavadas del mes.`)) return;
    setBusy(true);
    const r = await post("/api/socio/cancel", { id: w.id });
    setBusy(false);
    setMsg(r.ok ? { ok: true, t: "Lavada cancelada. Puedes apartar otra." } : { ok: false, t: r.data.error ?? "No se pudo cancelar." });
    load();
  }
  async function endMembership() {
    if (!confirm("¿Cancelar tu membresía? Ya no se te cobrará; puedes usar lo que ya pagaste hasta que termine tu mes.")) return;
    const r = await post("/api/socio/end");
    setMsg(r.ok ? { ok: true, t: "Membresía cancelada. Ya no se te cobrará." } : { ok: false, t: r.data.error ?? "No se pudo cancelar." });
    load();
  }

  // Siempre claro: activa (hasta cuándo), falta pagar o vencida. Nunca "cancelado" sin explicar.
  const statusLine = m.status === "pending" ? { c: "text-gold", t: m.processing ? "Si ya pagaste en Mercado Pago, se activa en unos minutos" : "Falta tu primer pago" }
    : m.valid ? { c: "text-go", t: `Activa hasta el ${lastDay ? longDay(lastDay) : ""}${m.status === "cancelled" ? " · no se renueva" : ""}` }
    : { c: "text-stop", t: "Vencida · renueva para apartar" };

  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <div className="flex items-center justify-between">
        <p className="text-xl font-bold">Hola, {m.name.split(" ")[0]}</p>
        <button type="button" onClick={async () => { await post("/api/socio/logout"); setMe("out"); }} className="min-h-12 rounded-xl border border-white/20 px-5 text-sm font-semibold">Salir</button>
      </div>

      {msg && <p role="status" className={`rounded-2xl p-4 text-base font-semibold ${msg.ok ? "bg-go/15 text-[#bff5d3]" : "bg-stop/15 text-red-200"}`}>{msg.t}</p>}

      {/* Tarjeta de socio: el sello cambia cada 30 s y coincide con el que ve el empleado en "Hoy" */}
      <section className="keep-dark overflow-hidden rounded-3xl border border-gold/40 bg-[linear-gradient(160deg,#241c09,#0f0e0b_60%,#0b0b0c)] text-white shadow-[0_20px_40px_-24px_rgba(0,0,0,.6)]">
        {seal && <ReceiptSeal endpoint="/api/socio/seal" initial={seal} />}
        <div className="border-t border-dashed border-gold/30 px-6 py-5 text-center">
          <p className="text-xs font-semibold tracking-[.2em] text-white/55">SOCIO</p>
          <p className="num text-3xl font-semibold text-gold">{m.code}</p>
          <p className="mt-1 text-base text-white/80">{vehicleLabel(m.vehicle)} · {m.perPeriod} lavadas al mes</p>
          <p className={`mt-2 text-base font-bold ${statusLine.c}`}>{statusLine.t}</p>
        </div>
      </section>

      {/* Tus 4 lavadas del mes */}
      {m.valid && (
        <section>
          <p className="text-lg font-bold">Te quedan <span className="num text-gold">{Math.max(0, m.perPeriod - me.used)} de {m.perPeriod}</span> lavadas este mes</p>
          <div className="mt-3 grid grid-cols-4 gap-2" aria-label="Lavadas del mes">
            {Array.from({ length: m.perPeriod }, (_, i) => {
              const w = me.washes[i];
              return (
                <div key={i} className={`flex h-20 flex-col items-center justify-center rounded-2xl border-2 text-center leading-tight ${w ? (w.past ? "border-white/15 bg-white/[.05] text-white/60" : "border-gold bg-gold/10") : "border-dashed border-white/20"}`}>
                  {w ? (<><span className="text-sm font-bold">{w.past ? "✓ " : ""}{shortDay(w.date).split(" ").slice(0, 2).join(" ")}</span><span className="num text-xs">{range(w.time, w.duration)}</span></>)
                    : <span className="text-sm text-white/55">Disponible</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Acciones: apartar, o "estoy aquí" si está libre ahorita */}
      {canBook && (
        <div className="grid gap-3">
          {libre && <button type="button" disabled={busy} onClick={() => book({ now: true })} className="min-h-16 rounded-2xl bg-go text-lg font-bold text-ink active:scale-[.98] disabled:opacity-50">Estoy aquí: lavar ahora</button>}
          {pick ? (
            <div className="rounded-3xl border border-gold/40 bg-white/[.04] p-5 text-center">
              <p className="text-sm text-white/60">Apartar</p>
              <p className="text-2xl font-bold">{longDay(pick.date)}</p>
              <p className="num text-3xl font-bold text-gold">{range(pick.time, WASH_MIN[m.vehicle])}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => { setPick(null); setPicking(true); }} className="btn-line min-h-14">Cambiar</button>
                <button type="button" disabled={busy} onClick={() => book(pick)} className="btn-gold min-h-14 disabled:opacity-50">{busy ? "Apartando…" : "Apartar"}</button>
              </div>
            </div>
          ) : picking ? (
            <div className="rounded-3xl border border-white/10 bg-white/[.03] p-4">
              <div className="mb-3 flex items-center justify-between"><p className="text-lg font-bold">Elige día y hora</p><button type="button" onClick={() => setPicking(false)} className="min-h-11 px-3 text-sm text-white/70">Cerrar</button></div>
              <SlotPicker hours={hours} until={m.periodEnd} vehicle={m.vehicle} onPick={(date, time) => setPick({ date, time })} />
            </div>
          ) : (
            <button type="button" onClick={() => setPicking(true)} className="btn-gold min-h-16 text-lg">Apartar lavada</button>
          )}
        </div>
      )}
      {m.valid && left === 0 && <p className="rounded-2xl bg-white/[.05] p-4 text-center text-white/75">Ya apartaste tus {m.perPeriod} lavadas de este mes.</p>}

      {/* Próximas lavadas */}
      {upcoming.length > 0 && (
        <section>
          <p className="text-lg font-bold">Próximas</p>
          <ul className="mt-2 grid gap-2">
            {upcoming.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[.05] px-4 py-3">
                <span><span className="block font-bold first-letter:uppercase">{longDay(w.date)}</span><span className="num block text-gold">{range(w.time, w.duration)}</span></span>
                {w.canChange ? <button type="button" disabled={busy} onClick={() => cancel(w)} className="min-h-12 rounded-xl border border-white/20 px-4 text-sm font-semibold">Cancelar</button>
                  : <span className="max-w-28 text-right text-xs text-white/50">Ya no se puede cambiar</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-white/55">Cambias o cancelas hasta 72 horas antes. Si no llegas, la lavada se pierde.</p>
        </section>
      )}

      {!m.valid && (
        <JoinRenew prices={prices} vehicle={m.vehicle} mpPublicKey={mpPublicKey} pending={m.status === "pending"} />
      )}

      <div className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/55">
        <a href={help} className="underline underline-offset-4">Ayuda</a>
        {m.status === "active" && <button type="button" onClick={endMembership} className="underline underline-offset-4">Cancelar membresía</button>}
      </div>
    </div>
  );
}

/** Entrar: celular + NIP. */
function Login({ onDone, help, prices, washes, mpPublicKey }: { onDone: () => void; help: string; prices: Record<Vehicle, number>; washes: number; mpPublicKey: string | null }) {
  const [phone, setPhone] = useState("");
  const [nip, setNip] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const r = await post("/api/socio/login", { phone, nip });
    setBusy(false);
    if (!r.ok) { setError(r.data.error ?? "No pudimos entrar."); return; }
    onDone();
  }
  return (
    <div className="grid gap-6">
      <form onSubmit={go} className="grid gap-4 rounded-[28px] border border-white/10 bg-white/[.03] p-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold text-gold">Cuenta de socio</h1>
          <p className="mt-2 text-base text-white/60">Entra con tu celular y tu NIP.</p>
        </div>
        <label className="grid gap-1.5 text-sm font-semibold text-white/70">Celular
          <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10 dígitos" inputMode="tel" autoComplete="tel" maxLength={20} />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-white/70">NIP de 4 números
          <input className={`${field} num text-center text-2xl tracking-[.5em]`} value={nip} onChange={(e) => setNip(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" inputMode="numeric" type="password" autoComplete="current-password" />
        </label>
        {error && <p role="alert" className="rounded-2xl bg-stop/15 p-4 text-base font-semibold text-red-200">{error}</p>}
        <button disabled={busy || phone.replace(/\D/g, "").length < 10 || nip.length < 4} className="btn-gold mt-1 min-h-16 text-lg disabled:opacity-45">{busy ? "Entrando…" : "Entrar"}</button>
        <p className="text-center text-sm text-white/55">¿Olvidaste tu NIP? <a href={help} className="text-gold underline underline-offset-4">Llámanos</a> y te damos uno nuevo.</p>
      </form>
      <div className="keep-dark rounded-[28px] border border-gold/30 bg-[linear-gradient(160deg,#1c1709,#0b0b0c)] p-6 text-white text-center">
        <p className="text-sm font-semibold uppercase tracking-[.22em] text-gold">Suscripción mensual</p>
        <p className="mt-2 text-lg text-white/85">{washes} lavadas completas al mes</p>
        <p className="num mt-1 text-base text-white/60">Carro ${prices.carro} · Camioneta ${prices.camioneta} · SUV/pick up ${prices.suv} al mes</p>
        <div className="mt-5"><JoinFlow prices={prices} washes={washes} mpPublicKey={mpPublicKey} label="Suscribirme" /></div>
      </div>
    </div>
  );
}

/** Renovar después de vencer: nuevo cobro automático con la sesión del socio. */
function JoinRenew({ prices, vehicle, mpPublicKey, pending }: { prices: Record<Vehicle, number>; vehicle: Vehicle; mpPublicKey: string | null; pending?: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  return (
    <section className="rounded-3xl border border-gold/40 bg-white/[.03] p-5 text-center">
      <p className="text-lg font-bold">{pending ? "Activa tu membresía" : "Renueva tu membresía"}</p>
      {pending && <p className="mt-1 text-sm text-white/65">Tu cuenta ya está creada. Paga para usar tus lavadas.</p>}
      <p className="num mt-1 text-3xl font-bold text-gold">${prices[vehicle]} <span className="text-base font-semibold text-white/60">al mes</span></p>
      {!open ? <button type="button" onClick={() => setOpen(true)} className="btn-gold mt-4 min-h-16 w-full text-lg">{pending ? "Pagar y activar" : "Renovar"}</button> : (
        <div className="mt-4 text-left">
          {error && <p role="alert" className="mb-3 rounded-2xl bg-stop/15 p-4 text-base font-semibold text-red-200">{error}</p>}
          {mpPublicKey ? (
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-semibold text-white/70">Tu correo
                <input className="min-h-14 w-full rounded-2xl border-2 border-white/15 bg-black/30 px-4 text-lg text-white outline-none placeholder:text-white/40 focus:border-gold" value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="tucorreo@ejemplo.com" inputMode="email" autoComplete="email" maxLength={120} />
              </label>
              <MpButton checkoutUrl="/api/socio/checkout" body={{ email }} disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)} onError={setError} label={`Pagar $${prices[vehicle]} con Mercado Pago`} />
            </div>
          ) : <p className="text-center text-white/70">Los pagos en línea se están activando.</p>}
        </div>
      )}
    </section>
  );
}
