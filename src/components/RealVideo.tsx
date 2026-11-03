"use client";
import { useEffect, useRef, useState } from "react";

// El video real del lugar. Arranca en silencio (regla de los navegadores);
// el sonido de lavado solo suena aquí y solo si la persona lo activa.
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
    <div className="video-reflect relative mx-auto w-full overflow-hidden rounded-[26px] border-[3px] border-[#111] shadow-[0_40px_80px_rgba(0,0,0,.45),0_0_0_1px_rgba(212,175,55,.35)]">
      <video ref={ref} className="block aspect-[9/16] w-full object-cover" src="/media/luxe-real.mp4" poster="/media/luxe-poster.jpg"
        muted loop playsInline preload="none" aria-label="Video real del lavado en LUXE GARAGE" />
      <button onClick={toggle} aria-pressed={!muted}
        className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-black/70 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition active:scale-95">
        {muted ? "🔊 Escuchar el lavado" : "🔇 Silenciar"}
      </button>
    </div>
  );
}
