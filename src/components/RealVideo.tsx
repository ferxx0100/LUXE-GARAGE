"use client";
import { useEffect, useRef, useState } from "react";

// El video real del lugar. Arranca en silencio (regla de los navegadores);
// el sonido de lavado solo suena si la persona lo activa. Los efectos van DETRÁS del video, nunca encima.
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

  function toggle() {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) v.play().catch(() => {});
  }

  return (
    <figure className="relative mx-auto w-[64%] max-w-[17rem]">
      <div className="relative overflow-hidden rounded-[26px] border-2 border-gold/70 shadow-[0_0_0_6px_rgba(212,175,55,.12),0_30px_70px_rgba(20,15,5,.45)]">
        <video ref={ref} className="block aspect-[9/16] w-full object-cover" src="/media/luxe-real.mp4" poster="/media/luxe-poster.jpg"
          muted loop playsInline preload="none" aria-label="Video real del lavado en LUXE GARAGE" />
      </div>
      <figcaption className="relative mt-4 flex justify-center">
        <button type="button" onClick={toggle} aria-pressed={!muted}
          className="flex min-h-12 items-center gap-2 whitespace-nowrap rounded-full border border-black/15 bg-ink/85 px-5 text-base font-semibold text-white backdrop-blur active:scale-95">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 9v6h4l5 4V5L8 9H4Z" />
            {muted ? <path d="m17 9 4 6m0-6-4 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
          </svg>
          {muted ? "Escuchar el lavado" : "Silenciar"}
        </button>
      </figcaption>
    </figure>
  );
}
