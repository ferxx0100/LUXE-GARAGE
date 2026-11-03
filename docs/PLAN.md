# Plan LUXE GARAGE

## Supuestos vigentes (confirmar con el dueño)
| Tema | Supuesto |
|---|---|
| Espacios | 1 solo espacio de lavado |
| Horario | Lun–jue 12–7 pm · Vie–sáb 1–6 pm · Dom cerrado |
| Duración por servicio | 60 min por horario reservable |
| Bloqueo mientras se paga | 15 min |
| Servicios | Exterior e interior / Solo exterior · Carro $180 · Camioneta $220 |
| Domicilio | +$100 por cada ida |
| Suscripción | $555/mes, 6 lavadas al mes; elige 6 días; sin reservar hora |
| Apple Pay | Mercado Pago lo ofrece en MX (Checkout API, Safari). Requiere Apple Developer + dominio propio verificado |
| Pago de reserva | Completo, en línea. Sin WhatsApp para reservar |

## Fases
- [x] **0. Blindaje**: `CLAUDE.md`, `.gitignore`, `.env.example`, gitleaks (pre-commit), Dependabot, cabeceras de seguridad.
  - [ ] `.claude/settings.json` + `.claude/hooks/proteger-secretos.sh`: requieren aprobación humana (ver `CLAUDE.md` Parte C).
- [x] **1. Marca**: emblema vectorial (`public/brand/emblem.svg`), paleta negro/oro/azulejo, video editado (`public/media/`).
- [x] **2. Hero en vivo**: garage animado (SVG) con LIBRE/OCUPADO/CERRADO, sondeo cada 5 s, panel `/admin` con botón.
- [x] **2b. Control en Vercel**: Upstash Redis para estado y ajustes; `/admin` con login (cookie firmada, límite de intentos, verificación de origen); precios, horario, días y aviso editables; página pública estática que se regenera al guardar.
- [x] **2c. Diseño celular**: escena del garage real (azulejo + fosa de acero), semáforo LED, Accord gris animado, cortina de cierre, tipografía Cinzel + Manrope, botón Ayuda (llamada/WhatsApp/quejas), video real con efectos de lavado, panel con dos interruptores.
- [x] **3. Reservas**: calendario 14 días, horarios por hora, apartado atómico de 15 min, límite de intentos, comprobante `/reserva/[id]` + `.ics`.
- [x] **4. Pagos**: Mercado Pago Card Payment Brick + `/v1/payments` + webhook firmado e idempotente (falta: credenciales en Vercel y Apple Pay).
- [x] **6a. Agenda en el panel**: citas por día, cobrado, domicilio, llamar/WhatsApp, completar/cancelar, clientes.
- [ ] **5. Suscripción**: alta mensual, elección de 6 días, créditos, domicilio +$50.
- [ ] **6. Panel admin real**: login + 2FA, horarios, bloqueos, reservas, suscriptores, auditoría.
- [ ] **7. Endurecimiento**: aviso de privacidad (LFPDPPP), monitoreo, alertas de pago, pruebas de carga y doble reserva.
- [ ] **8. Futuro**: cámaras para detectar el auto; Stripe.

## Nota
Sin Upstash Redis conectado, el estado vive en memoria y no se comparte entre instancias de Vercel. El panel lo avisa con una franja amarilla. Pasos en `docs/VERCEL.md`.
