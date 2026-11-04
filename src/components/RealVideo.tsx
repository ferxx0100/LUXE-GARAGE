"use client";
import { useEffect, useRef, useState } from "react";

// El video real del lugar, grande. Arranca en silencio (regla de los navegadores).
// El botón de sonido va encima del video y desaparece al activarlo; queda un botón chico para silenciar.
export default function RealVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {});
      else { v.pause(); v.muted = true; setMuted(true); }
    }, { threshold: 0.35 });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  function setSound(on: boolean) {
    const v = ref.current;
    if (!v) return;
    v.muted = !on;
    setMuted(!on);
    if (on) v.play().catch(() => {});
  }

  return (
    <figure className="relative overflow-hidden rounded-[28px] border border-gold/40 bg-black shadow-[0_30px_70px_-25px_rgba(0,0,0,.8)]">
      <video ref={ref} className="block aspect-[9/16] w-full object-cover" src="/media/luxe-real.mp4" poster="/media/luxe-poster.jpg"
        muted loop playsInline preload="none" aria-label="Video real del lavado en LUXE GARAGE" onClick={() => setSound(muted)} />
      {muted ? (
        <button type="button" onClick={() => setSound(true)}
          className="absolute inset-x-0 bottom-6 mx-auto flex min-h-14 w-max items-center gap-3 rounded-full bg-black/60 px-6 text-lg font-semibold text-white ring-1 ring-white/25 backdrop-blur-md active:scale-95">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
          </svg>
          Activar sonido
        </button>
      ) : (
        <button type="button" onClick={() => setSound(false)} aria-label="Silenciar"
          className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-md active:scale-95">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="m17 9 4 6m0-6-4 6" />
          </svg>
        </button>
      )}
    </figure>
  );
}
