"use client";
import { useCallback, useEffect, useState } from "react";
import { Semaforo } from "@/components/GarageScene";

type Settings = {
  prices: { carro: number; camioneta: number; domicilio: number; suscripcion: number };
  subscriptionWashes: number;
  hours: { open: number; close: number; days: number[] };
  notice: string;
};
type Garage = { open: boolean; busy: boolean; updatedAt: string | null };
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
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function setGarage(patch: Partial<Pick<Garage, "open" | "busy">>) {
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
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña" className={input} required />
          <button disabled={busy || !password} className="w-full rounded-lg bg-gold py-3 font-semibold text-black disabled:opacity-50">Entrar</button>
        </form>
        <p className="mt-4 min-h-5 text-sm text-red-300" role="status">{msg}</p>
      </main>
    );

  const g = data?.garage;
  const preview: "LIBRE" | "OCUPADO" | "CERRADO" = !g || !g.open ? "CERRADO" : g.busy ? "OCUPADO" : "LIBRE";
  const set = (patch: Partial<Settings>) => setForm((f) => f && { ...f, ...patch });

  return (
    <main className="mx-auto max-w-2xl p-5 pb-24 pt-10">
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

      <section className="mt-8">
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
            <p className="mt-1 text-xs text-white/40">Fuera del horario siempre se ve CERRADO.</p>
          </div>
        </div>

        <Switch label="Negocio" on={g?.open ?? true} onText="Abierto" offText="Cerrado" onCls="bg-emerald-500" offCls="bg-zinc-600"
          hint="Cerrado baja la cortina en la página." disabled={busy} onChange={(v) => setGarage({ open: v })} />
        <Switch label="Fosa" on={!(g?.busy ?? false)} onText="Libre" offText="Ocupado" onCls="bg-emerald-500" offCls="bg-red-500"
          hint="Ocupado: el auto entra a la fosa y el semáforo se pone en rojo." disabled={busy || !(g?.open ?? true)} onChange={(v) => setGarage({ busy: !v })} />
      </section>

      {form && (
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
