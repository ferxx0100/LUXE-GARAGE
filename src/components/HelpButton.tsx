"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Único canal humano: ayuda, urgencias y quejas. Las reservas y pagos son 100 % en la web.
export default function HelpButton({ tel, whatsapp, phoneDisplay }: { tel: string; whatsapp: string; phoneDisplay: string }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const Item = ({ href, title, sub, icon }: { href: string; title: string; sub: string; icon: React.ReactNode }) => (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
      className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[.04] p-4 transition active:scale-[.98] hover:border-gold/60">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">{icon}</span>
      <span><span className="block font-semibold">{title}</span><span className="block text-sm text-white/60">{sub}</span></span>
    </a>
  );
  const phone = <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>;
  const chat = <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20z"/></svg>;

  return (
    <>
      <button onClick={() => setOpen(true)} aria-haspopup="dialog"
        className="flex items-center gap-1.5 rounded-full border border-gold/45 py-1.5 pl-1.5 pr-3.5 text-[13px] font-semibold text-gold transition hover:bg-gold/10 active:scale-95">
        <span className="grid size-6 place-items-center rounded-full bg-gold text-[12px] font-bold text-ink">?</span>
        Ayuda
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="ayuda-t" onClick={(e) => e.stopPropagation()}
            className="sheet-in w-full max-w-md rounded-t-3xl border border-white/10 bg-ink-2 p-5 sm:rounded-3xl"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="ayuda-t" className="font-display text-xl text-gold">¿Necesitas ayuda?</h2>
                <p className="mt-1 text-sm text-white/60">Te atiende una persona del garage · <span className="whitespace-nowrap">{phoneDisplay}</span></p>
              </div>
              <button ref={closeRef} onClick={() => setOpen(false)} className="rounded-full p-2 text-white/60 hover:text-white" aria-label="Cerrar">✕</button>
            </div>
            <div className="mt-5 grid gap-3">
              <Item href={tel} title="Ayuda urgente" sub="Llamada directa" icon={phone} />
              <Item href={whatsapp} title="Mensaje por WhatsApp" sub="Dudas sobre tu reserva o servicio" icon={chat} />
              <Item href={tel} title="Quejas" sub="Llamada directa con el encargado" icon={phone} />
            </div>
            <p className="mt-4 text-center text-xs text-white/40">Las reservas y pagos se hacen aquí en la página.</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
