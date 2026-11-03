"use client";
import { useCallback, useEffect, useState } from "react";
import { Semaforo } from "@/components/GarageScene";
import AdminAgenda from "@/components/AdminAgenda";

type Settings = {
  prices: { carro: number; camioneta: number; domicilio: number; suscripcion: number };
  subscriptionWashes: number;
  hours: { open: number; close: number; days: number[] };
  notice: string;
};
type Pub = "LIBRE" | "OCUPADO" | "CERRADO";
type Garage = { mode: "auto" | "open" | "closed"; busy: boolean; updatedAt: string | null; public: Pub; reason: "manual-open" | "manual-closed" | "schedule-open" | "schedule-closed" };
type Data = { settings: Settings; garage: Garage | null; storage: "redis" | "memory" };

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const PRICE_FIELDS: { key: keyof Settings["prices"]; label: string }[] = [
  { key: "carro", label: "Lavado carro" },
  { key: "camioneta", label: "Lavado camioneta" },
  { key: "domicilio", label: "Extra domicilio (por ida)" },
  { key: "suscripcion", label: "Suscripción mensual" },
];

async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(`/api/admin/${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

const input = "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 outline-none focus:border-gold";

export default function Admin() {
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"garage" | "agenda" | "ajustes">("agenda");

  const load = useCallback(async () => {
    const r = await api("settings");
    if (r.status === 401) return setAuthed(false);
    if (!r.ok) return setMsg("No se pudo cargar");
    setAuthed(true);
    setData(r.data);
    setForm(r.data.settings);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await api("login", "POST", { password });
    setBusy(false);
    setPassword("");
    if (r.ok) { setMsg(""); load(); } else setMsg(r.data.error ?? "Error");
  }

  async function setGarage(patch: Partial<Pick<Garage, "mode" | "busy">>) {
    setBusy(true);
    const r = await api("garage", "POST", patch);
    setBusy(false);
    if (r.status === 401) return setAuthed(false);
    if (r.ok) { setData((d) => d && { ...d, garage: r.data }); setMsg("Listo. La página se actualiza en segundos."); }
    else setMsg(r.data.error ?? "Error");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    const r = await api("settings", "PUT", form);
    setBusy(false);
    if (r.status === 401) return setAuthed(false);
    setMsg(r.ok ? "Ajustes guardados. La página pública ya los muestra." : r.data.error ?? "Error");
  }

  async function logout() {
    await api("logout", "POST");
    setAuthed(false); setData(null); setForm(null);
  }

  if (authed === null) return <main className="p-10 text-center text-white/60">Cargando…</main>;

  if (!authed)
    return (
      <main className="mx-auto max-w-sm p-6 pt-24">
        <h1 className="font-display text-2xl text-gold">Panel LUXE GARAGE</h1>
        <form onSubmit={login} className="mt-6 space-y-3">
          <div className="relative">
            <input type={show ? "text" : "password"} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña"
              className={`${input} py-4 pr-14 text-lg`} required aria-label="Contraseña del panel" />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar contraseña" : "Ver contraseña"} aria-pressed={show}
              className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-lg text-white/70 hover:text-white">
              {show ? (
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.7 9.7 0 0112 5c5 0 9 4.5 10 7a12.6 12.6 0 01-3.2 4.3M6.6 6.6A12.7 12.7 0 002 12c1 2.5 5 7 10 7a9.6 9.6 0 004.1-.9" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
          </div>
          <button disabled={busy || !password} className="w-full rounded-xl bg-gold py-4 text-lg font-semibold text-black disabled:opacity-50">{busy ? "Entrando…" : "Entrar"}</button>
        </form>
        <p className="mt-4 min-h-5 text-base text-red-300" role="status">{msg}</p>
      </main>
    );

  const g = data?.garage;
  const preview: Pub = g?.public ?? "CERRADO";
  const why = {
    "manual-open": "Abierto a mano: hoy manda tu decisión sobre el horario.",
    "manual-closed": "Cerrado a mano por hoy. Mañana vuelve al horario.",
    "schedule-open": "Abierto según el horario.",
    "schedule-closed": "Cerrado porque está fuera del horario. Para abrir ahora toca \"Abierto hoy\".",
  }[g?.reason ?? "schedule-closed"];
  const set = (patch: Partial<Settings>) => setForm((f) => f && { ...f, ...patch });

  return (
    <main className="mx-auto max-w-2xl px-5 pb-24 pt-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-gold">Panel LUXE GARAGE</h1>
        <div className="flex shrink-0 gap-2 whitespace-nowrap text-sm">
          <a href="/" target="_blank" className="rounded-lg border border-white/15 px-3 py-2 hover:border-gold">Ver sitio</a>
          <button onClick={logout} className="rounded-lg border border-white/15 px-3 py-2 hover:border-gold">Salir</button>
        </div>
      </header>

      {data?.storage === "memory" && (
        <p className="mt-4 rounded-lg border border-amber-400/60 bg-amber-500/10 p-3 text-sm text-amber-200">
          Almacenamiento temporal: los cambios no se comparten entre servidores ni sobreviven reinicios.
          Conecta Upstash Redis en Vercel (ver docs/VERCEL.md).
        </p>
      )}

      <nav className="sticky top-0 z-20 -mx-5 mt-6 grid grid-cols-3 gap-1 bg-ink/95 px-5 py-2 backdrop-blur" aria-label="Secciones del panel">
        {([["agenda", "📅 Agenda"], ["garage", "🚦 Garage"], ["ajustes", "⚙️ Ajustes"]] as const).map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
            className={`rounded-xl py-3 text-base font-bold transition ${tab === k ? "bg-gold text-ink" : "bg-white/[.05] text-white/80"}`}>{t}</button>
        ))}
      </nav>

      {tab === "agenda" && <div className="mt-6"><AdminAgenda onUnauthorized={() => setAuthed(false)} onMsg={setMsg} /></div>}

      {tab === "garage" && <section className="mt-8">
        <h2 className="text-sm tracking-[.3em] text-white/50">SEMÁFORO DEL GARAGE</h2>
        <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-5 rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <svg viewBox="0 0 48 128" className="h-36 w-auto" aria-label={`Así lo ve el cliente: ${preview}`}>
            <defs>
              <filter id="lg-glow-sm" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <filter id="lg-glow-lg" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="9" /></filter>
            </defs>
            <Semaforo status={preview} x={2} y={2} />
          </svg>
          <div>
            <p className="text-xs text-white/50">Así lo ve el cliente ahora:</p>
            <p className={`font-display mt-1 text-3xl font-semibold ${preview === "LIBRE" ? "text-emerald-400" : preview === "OCUPADO" ? "text-red-400" : "text-zinc-400"}`}>{preview}</p>
            <p className="mt-1 text-sm text-white/70">{why}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <p className="text-xs tracking-[.25em] text-white/60">NEGOCIO</p>
          <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Negocio">
            {([["auto", "Automático", "Sigue el horario", "border-gold bg-gold/15 text-gold"], ["open", "Abierto hoy", "Aunque sea fuera de horario", "border-emerald-400 bg-emerald-500/20 text-emerald-200"], ["closed", "Cerrado hoy", "Baja la cortina", "border-zinc-300 bg-zinc-500/25 text-zinc-100"]] as const).map(([m, t, h, on]) => (
              <button key={m} role="radio" aria-checked={g?.mode === m} disabled={busy} onClick={() => setGarage({ mode: m })}
                className={`rounded-xl border-2 px-2 py-3 text-center transition active:scale-[.98] disabled:opacity-50 ${g?.mode === m ? on : "border-white/10 text-white/75"}`}>
                <span className="block text-base font-bold leading-tight">{t}</span>
                <span className="mt-1 block text-[11px] leading-tight opacity-80">{h}</span>
              </button>
            ))}
          </div>
        </div>
        <Switch label="Fosa" on={!(g?.busy ?? false)} onText="Libre" offText="Ocupado" onCls="bg-emerald-500" offCls="bg-red-500"
          hint={preview === "CERRADO" ? "Abre el negocio para poder cambiar la fosa." : "Ocupado: el auto entra a la fosa y el semáforo se pone en rojo."} disabled={busy || preview === "CERRADO"} onChange={(v) => setGarage({ busy: !v })} />
      </section>}

      {tab === "ajustes" && form && (
        <form onSubmit={save} className="mt-10 space-y-8">
          <section>
            <h2 className="text-sm tracking-[.3em] text-white/50">PRECIOS (MXN)</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {PRICE_FIELDS.map((f) => (
                <label key={f.key} className="block text-sm text-white/70">{f.label}
                  <input type="number" min={0} step={1} inputMode="numeric" className={`${input} mt-1`} value={form.prices[f.key]}
                    onChange={(e) => set({ prices: { ...form.prices, [f.key]: Math.max(0, Math.round(Number(e.target.value) || 0)) } })} />
                </label>
              ))}
              <label className="block text-sm text-white/70">Lavadas por mes (suscripción)
                <input type="number" min={1} max={31} className={`${input} mt-1`} value={form.subscriptionWashes}
                  onChange={(e) => set({ subscriptionWashes: Math.min(31, Math.max(1, Math.round(Number(e.target.value) || 1))) })} />
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-sm tracking-[.3em] text-white/50">HORARIO</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(["open", "close"] as const).map((k) => (
                <label key={k} className="block text-sm text-white/70">{k === "open" ? "Abre" : "Cierra"}
                  <select className={`${input} mt-1`} value={form.hours[k]}
                    onChange={(e) => set({ hours: { ...form.hours, [k]: Number(e.target.value) } })}>
                    {Array.from({ length: 25 }, (_, h) => h).filter((h) => (k === "open" ? h < 24 : h > 0)).map((h) => (
                      <option key={h} value={h} className="bg-ink">{h}:00</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {DAYS.map((d, i) => {
                const on = form.hours.days.includes(i);
                return (
                  <button type="button" key={d} aria-pressed={on}
                    onClick={() => set({ hours: { ...form.hours, days: on ? form.hours.days.filter((x) => x !== i) : [...form.hours.days, i].sort() } })}
                    className={`rounded-full border px-4 py-2 text-sm ${on ? "border-gold bg-gold/15 text-gold" : "border-white/15 text-white/50"}`}>
                    {d}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-sm tracking-[.3em] text-white/50">AVISO EN LA PÁGINA</h2>
            <input maxLength={160} className={`${input} mt-3`} value={form.notice} placeholder="Ej. Hoy cerramos a las 17:00 (vacío = sin aviso)"
              onChange={(e) => set({ notice: e.target.value })} />
          </section>

          <button disabled={busy} className="w-full rounded-xl bg-gold py-4 text-lg font-semibold text-black disabled:opacity-50">Guardar ajustes</button>
        </form>
      )}

      <p className="fixed inset-x-0 bottom-0 bg-ink/95 p-3 text-center text-sm text-white/80 empty:hidden" role="status">{msg}</p>
    </main>
  );
}

function Switch({ label, on, onText, offText, onCls, offCls, hint, disabled, onChange }: {
  label: string; on: boolean; onText: string; offText: string; onCls: string; offCls: string; hint: string; disabled?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs tracking-[.25em] text-white/50">{label.toUpperCase()}</p>
          <p className="mt-0.5 text-2xl font-bold">{on ? onText : offText}</p>
        </div>
        <button role="switch" aria-checked={on} aria-label={`${label}: ${on ? onText : offText}`} disabled={disabled} onClick={() => onChange(!on)}
          className={`relative h-14 w-28 shrink-0 rounded-full transition-colors disabled:opacity-40 ${on ? onCls : offCls}`}>
          <span className={`absolute top-1.5 size-11 rounded-full bg-white shadow-lg transition-all ${on ? "left-[3.75rem]" : "left-1.5"}`} />
        </button>
      </div>
      <p className="mt-2 text-xs text-white/45">{hint}</p>
    </div>
  );
}
