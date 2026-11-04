"use client";
import { useEffect, useMemo, useState } from "react";
import TimeGrid from "./TimeGrid";
import { addDays, DAY, MONTH, mxNow, wd, type DayHours } from "./fmt";

/**
 * Un solo calendario para todos (socios y lavada suelta): días en fila y turnos de 30 min.
 * `until` (exclusivo) limita los días al mes pagado del socio.
 */
export default function SlotPicker({ hours, until, onPick, initialDate }: {
  hours: DayHours[]; until?: string | null; onPick: (date: string, time: string) => void; initialDate?: string | null;
}) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(mxNow().date), []);
  const days = useMemo(() => {
    if (!today) return [];
    const out: string[] = [];
    for (let i = 0; i < 31 && out.length < 14; i++) {
      const d = addDays(today, i);
      if (until && d >= until) break;
      if (hours[wd(d)]) out.push(d);
    }
    return out;
  }, [today, until, hours]);
  const [date, setDate] = useState<string | null>(initialDate ?? null);
  useEffect(() => { if (!date && days.length) setDate(days[0]); }, [days, date]);
  const [starts, setStarts] = useState<string[] | null>(null);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    setStarts(null);
    fetch(`/api/booking/availability?date=${date}&kind=completo`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setStarts(Array.isArray(d.starts) ? d.starts : []))
      .catch(() => alive && setStarts([]));
    return () => { alive = false; };
  }, [date]);

  if (!today) return <p className="py-6 text-center text-white/60">Cargando…</p>;
  if (!days.length) return <p className="py-6 text-center text-white/70">No hay días disponibles.</p>;

  return (
    <div className="min-w-0 max-w-full [contain:inline-size]">
      <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2" role="listbox" aria-label="Día">
        {days.map((d) => {
          const on = d === date;
          const label = d === today ? "Hoy" : d === addDays(today, 1) ? "Mañana" : DAY[wd(d)].slice(0, 3);
          return (
            <button key={d} type="button" role="option" aria-selected={on} onClick={() => setDate(d)}
              aria-label={`${DAY[wd(d)]} ${Number(d.slice(8))} de ${MONTH[Number(d.slice(5, 7)) - 1]}`}
              className={`min-h-16 min-w-[4.4rem] shrink-0 rounded-2xl border-2 px-2 text-center transition active:scale-95 ${on ? "border-gold bg-gold text-ink" : "border-white/12 bg-white/[.04]"}`}>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="num block text-xl font-bold leading-tight">{Number(d.slice(8))}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 min-h-40">
        {starts === null ? <p className="py-6 text-center text-white/60">Buscando turnos…</p>
          : starts.length === 0 ? <p className="rounded-2xl bg-white/[.04] p-4 text-center text-white/75">Ese día ya no hay turnos. Elige otro.</p>
          : <TimeGrid starts={starts} next={starts[0]} onPick={(t) => date && onPick(date, t)} />}
      </div>
    </div>
  );
}
