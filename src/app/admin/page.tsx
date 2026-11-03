"use client";
import { useCallback, useEffect, useState } from "react";
import { Semaforo } from "@/components/GarageScene";
import AdminAgenda, { FosaBar, fmt12 } from "@/components/AdminAgenda";

type Settings = {
  prices: { carro: number; camioneta: number; domicilio: number; suscripcion: number };
  membershipWashes: number;
  hours: ({ open: number; close: number } | null)[];
  notice: string;
};
type Pub = "LIBRE" | "OCUPADO" | "CERRADO";
type Garage = { mode: "auto" | "open" | "closed"; busy: boolean; busySince?: string | null; busyMinutes?: number | null; busyUntil?: string | null; updatedAt: string | null; public: Pub; reason: "manual-open" | "manual-closed" | "schedule-open" | "schedule-closed" };
type Data = { settings: Settings; garage: Garage | null; storage: "redis" | "memory" };

const PRICE_FIELDS: { key: keyof Settings["prices"]; label: string }[] = [
  { key: "carro", label: "Lavado carro" },
  { key: "camioneta", label: "Lavado camioneta" },
  { key: "domicilio", label: "Extra domicilio (por ida)" },
  { key: "suscripcion", label: "Membresía (pago por 30 días)" },
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
  useEffect(() => { if (!msg || msg === "…") return; const t = setTimeout(() => setMsg(""), 4000); return () => clearTimeout(t); }, [msg]);
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
  // El semáforo puede cambiar desde otro teléfono: refresca solo el garage (no pisa el formulario de ajustes).
  useEffect(() => {
    if (!authed) return;
    const id = setInterval(async () => {
      const r = await api("settings");
      if (r.status === 401) return setAuthed(false);
      if (r.ok) setData((d) => (d ? { ...d, garage: r.data.garage } : r.data));
    }, 20000);
    return () => clearInterval(id);
  }, [authed]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await api("login", "POST", { password });
    setBusy(false);
    setPassword("");
    if (r.ok) { setMsg(""); load(); } else setMsg(r.data.error ?? "Error");
  }

  async function setGarage(patch: { mode?: Garage["mode"]; busy?: boolean; minutes?: 20 | 30 }) {
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
    <main className="mx-auto w-full max-w-2xl overflow-x-clip px-4 sm:px-5"
      style={{ paddingTop: "max(env(safe-area-inset-top), 12px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)", paddingLeft: "max(env(safe-area-inset-left), 16px)", paddingRight: "max(env(safe-area-inset-right), 16px)" }}>
      <header className="flex items-center justify-between gap-3 pt-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`size-3 shrink-0 rounded-full shadow-[0_0_12px_currentColor] ${preview === "LIBRE" ? "bg-emerald-400 text-emerald-400" : preview === "OCUPADO" ? "bg-red-500 text-red-500" : "bg-amber-300 text-amber-300"}`} aria-hidden />
          <h1 className="font-display truncate text-xl font-semibold tracking-wide"><span className="text-gold-grad">LUXE</span> <span className="text-white/80">Panel</span></h1>
        </div>
        <div className="flex shrink-0 gap-2 whitespace-nowrap text-sm">
          <a href="/" target="_blank" className="grid min-h-11 place-items-center rounded-xl border border-white/15 px-3 active:border-gold">Ver sitio</a>
          <button onClick={logout} className="min-h-11 rounded-xl border border-white/15 px-3 active:border-gold">Salir</button>
        </div>
      </header>

      {data?.storage === "memory" && (
        <p className="mt-4 rounded-lg border border-amber-400/60 bg-amber-500/10 p-3 text-sm text-amber-200">
          Almacenamiento temporal: los cambios no se comparten entre servidores ni sobreviven reinicios.
          Conecta Upstash Redis en Vercel (ver docs/VERCEL.md).
        </p>
      )}

      <nav className="sticky z-20 -mx-4 mt-4 grid grid-cols-3 gap-1.5 border-b border-white/5 bg-ink/90 px-4 py-2 backdrop-blur-xl sm:-mx-5 sm:px-5" style={{ top: "env(safe-area-inset-top)" }} aria-label="Secciones del panel">
        {([["agenda", "📅 Agenda"], ["garage", "🚦 Garage"], ["ajustes", "⚙️ Ajustes"]] as const).map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
            className={`min-h-14 rounded-2xl text-base font-bold transition active:scale-[.97] ${tab === k ? "bg-gold text-ink shadow-[0_6px_20px_-8px_rgba(212,175,55,.8)]" : "bg-white/[.05] text-white/80"}`}>{t}</button>
        ))}
      </nav>

      {tab === "agenda" && <div className="mt-6"><AdminAgenda onUnauthorized={() => setAuthed(false)} onMsg={setMsg} pub={g?.public ?? null} busyUntil={g?.busyUntil ?? null} onFosa={(busyNow, minutes) => setGarage(busyNow ? { busy: true, minutes: minutes ?? 30 } : { busy: false })} /></div>}

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
            {preview === "OCUPADO" && g?.busyUntil && <p className="text-base text-white/85">Se desocupa aprox. <b>{fmt12(g.busyUntil)}</b></p>}
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
        <p className="mb-2 mt-6 text-xs tracking-[.25em] text-white/60">FOSA</p>
        <FosaBar pub={preview} busyUntil={g?.busyUntil ?? null} disabled={busy}
          onFosa={(busyNow, minutes) => setGarage(busyNow ? { busy: true, minutes: minutes ?? 30 } : { busy: false })} />
        <p className="text-sm text-white/55">Ocupado: el auto entra a la fosa, el semáforo se pone en rojo y la página muestra a qué hora se desocupa.</p>
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
              <label className="block text-sm text-white/70">Lavadas completas de la membresía
                <input type="number" min={1} max={31} className={`${input} mt-1`} value={form.membershipWashes}
                  onChange={(e) => set({ membershipWashes: Math.min(31, Math.max(1, Math.round(Number(e.target.value) || 1))) })} />
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-sm tracking-[.3em] text-white/50">HORARIO</h2>
            <div className="mt-3 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
              {[1, 2, 3, 4, 5, 6, 0].map((i) => {
                const d = form.hours[i];
                const setDay = (v: { open: number; close: number } | null) => set({ hours: form.hours.map((x, j) => (j === i ? v : x)) });
                const opt = (h: number) => <option key={h} value={h} className="bg-ink">{h % 12 || 12} {h < 12 || h === 24 ? "am" : "pm"}</option>;
                return (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 ${d ? "bg-white/[.03]" : ""}`}>
                    <button type="button" onClick={() => setDay(d ? null : { open: 12, close: 19 })} aria-pressed={!!d}
                      className={`w-[6.5rem] shrink-0 rounded-lg px-1 py-3 text-left text-base font-bold ${d ? "text-white" : "text-white/40 line-through"}`}>
                      {["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][i]}
                    </button>
                    {d ? (
                      <div className="flex flex-1 items-center gap-2">
                        <select className={`${input} min-w-0 py-3 text-base`} value={d.open} onChange={(e) => setDay({ ...d, open: Number(e.target.value) })} aria-label="Abre">
                          {Array.from({ length: 24 }, (_, h) => h).map(opt)}
                        </select>
                        <span className="text-white/60">a</span>
                        <select className={`${input} min-w-0 py-3 text-base`} value={d.close} onChange={(e) => setDay({ ...d, close: Number(e.target.value) })} aria-label="Cierra">
                          {Array.from({ length: 24 }, (_, h) => h + 1).map(opt)}
                        </select>
                      </div>
                    ) : (
                      <span className="flex-1 text-sm text-white/50">Cerrado · toca el día para abrir</span>
                    )}
                  </div>
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

      <p className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/30 bg-ink/95 px-4 pt-3 text-center text-base font-semibold text-white/90 backdrop-blur empty:hidden" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }} role="status">{msg}</p>
    </main>
  );
}

