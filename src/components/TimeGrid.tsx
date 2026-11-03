"use client";
// Horas compactas y proporcionadas: una fila por hora ("4 pm") con sus inicios al lado (4:00 · 4:20 · 4:40).
// Mucho más corto que una lista larga y fácil de leer para todos.
const pad = (n: number) => String(n).padStart(2, "0");

export default function TimeGrid({ starts, value, onPick, next, tone = "gold" }: {
  starts: string[]; value?: string | null; onPick: (t: string) => void; next?: string | null; tone?: "gold" | "water";
}) {
  const rows = new Map<number, string[]>();
  for (const t of starts) { const h = Number(t.slice(0, 2)); rows.set(h, [...(rows.get(h) ?? []), t]); }
  const on = tone === "gold" ? "border-gold bg-gold text-ink" : "border-[#d36a8b] bg-[#8e2348] text-white";
  const hint = tone === "gold" ? "border-gold/70 text-gold" : "border-[#a9c4ff]/70 text-[#d6e2ff]";
  return (
    <div className="grid gap-1.5" role="listbox" aria-label="Horas disponibles">
      {[...rows.entries()].map(([h, list]) => (
        <div key={h} className="flex items-center gap-2 rounded-xl bg-white/[.04] px-2 py-1.5">
          <span className="w-[4.2rem] shrink-0 text-center leading-none">
            <span className="block text-xl font-extrabold tabular-nums">{h % 12 || 12}</span>
            <span className="block text-[11px] font-bold tracking-wider opacity-70">{h < 12 ? "AM" : "PM"}</span>
          </span>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {list.map((t) => {
              const sel = value === t, nx = next === t;
              const label = `${h % 12 || 12}:${pad(Number(t.slice(3, 5)))}`;
              return (
                <button key={t} type="button" role="option" aria-selected={sel} onClick={() => onPick(t)}
                  aria-label={`${label} ${h < 12 ? "am" : "pm"}${nx ? ", el más próximo" : ""}`}
                  className={`relative min-h-11 min-w-[4.1rem] flex-1 rounded-lg border-2 px-2 text-lg font-bold tabular-nums transition active:scale-95 ${sel ? on : nx ? hint : "border-white/12 bg-white/[.03]"}`}>
                  {label}
                  {nx && !sel && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
