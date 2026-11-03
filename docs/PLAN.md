# Plan LUXE GARAGE

## Supuestos vigentes (confirmar con el dueño)
| Tema | Supuesto |
|---|---|
| Espacios | 1 solo espacio de lavado |
| Horario | Lun–sáb 9:00–19:00, hora de Ciudad de México (`src/lib/config.ts`) |
| Duración por servicio | 60 min por horario reservable |
| Bloqueo mientras se paga | 15 min |
| Lavado normal | Carro $180 · Camioneta $220 (mismo precio exterior/interior) |
| Domicilio | +$50 por cada ida |
| Suscripción | $555/mes, 6 lavadas al mes; elige 6 días; sin reservar hora |
| Apple Pay | Pendiente: verificar disponibilidad en Checkout API para la cuenta MX |

## Fases
- [x] **0. Blindaje**: `CLAUDE.md`, `.gitignore`, `.env.example`, gitleaks (pre-commit), Dependabot, cabeceras de seguridad.
  - [ ] `.claude/settings.json` + `.claude/hooks/proteger-secretos.sh`: requieren aprobación humana (ver `CLAUDE.md` Parte C).
- [x] **1. Marca**: emblema vectorial (`public/brand/emblem.svg`), paleta negro/oro/azulejo, video editado (`public/media/`).
- [x] **2. Hero en vivo**: garage animado (SVG) con LIBRE/OCUPADO/CERRADO, sondeo cada 5 s, panel `/admin` con botón.
- [ ] **3. Reservas**: Supabase (estado + Realtime + reservas), calendario, bloqueo temporal, restricción única fecha+hora, rate limiting.
- [ ] **4. Pagos**: Mercado Pago Checkout API (Card Payment Brick) + Apple Pay + webhook firmado e idempotente.
- [ ] **5. Suscripción**: alta mensual, elección de 6 días, créditos, domicilio +$50.
- [ ] **6. Panel admin real**: login + 2FA, horarios, bloqueos, reservas, suscriptores, auditoría.
- [ ] **7. Endurecimiento**: aviso de privacidad (LFPDPPP), monitoreo, alertas de pago, pruebas de carga y doble reserva.
- [ ] **8. Futuro**: cámaras para detectar el auto; Stripe.

## Limitación actual (importante)
El estado del garage vive en memoria del servidor. En Vercel cada instancia tiene su propia memoria, así que el botón de `/admin` **no es confiable en producción** hasta la fase 3 (Supabase). En `npm run dev`/`npm start` local funciona.
