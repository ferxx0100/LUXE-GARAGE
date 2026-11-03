# LUXE GARAGE — Lo que falta

Estado: el código está en la rama `claude/busy-noether-my8mwr` y Vercel lo publica solo.
Sitio: https://luxegaragee.com · Panel: https://luxegaragee.com/admin

---

## 1. Revisar en tu iPhone (sin verificar todavía)
La última entrega compila y pasa las 16 pruebas automáticas, pero **no se vio en pantalla**. Revisa y manda captura de lo que se vea mal:
- [ ] Hero blanco en 3D: estados LIBRE / OCUPADO / CERRADO (con hora actual y "se desocupa a las…").
- [ ] Tarjeta "Próximo lugar" → botón "Apartar este lugar".
- [ ] Reserva en 3 pasos (solo nombre y teléfono).
- [ ] Membresía (tema agua con burbujas) → calendario de 6 días → pago.
- [ ] Sección del video sobre mosaico gris/crema.
- [ ] Comprobante `/reserva/...` y `/membresia/...` (sello que cambia cada 30 s y reloj con segundos).
- [ ] Panel: Agenda, Verificar recibo, Ocupado 30/20 min, Ajustes.

## 2. Mercado Pago (para poder cobrar)
1. mercadopago.com.mx/developers → **Tus integraciones** → **Crear aplicación**.
2. Credenciales **de prueba** primero. En Vercel → luxe-garage → Settings → Environment Variables:

| Variable | De dónde | Tipo |
|---|---|---|
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | Public Key | Config |
| `MP_ACCESS_TOKEN` | Access Token | Secret |
| `MP_WEBHOOK_SECRET` | Webhooks → URL `https://luxegaragee.com/api/mp/webhook`, evento **Pagos** → clave secreta | Secret |

3. **Redeploy**.
4. Haz una reserva y una membresía con las **tarjetas de prueba** de Mercado Pago.
5. Si todo sale bien, cambia a credenciales de **producción** y vuelve a hacer Redeploy.

## 3. Correos de confirmación (Resend)
1. Cuenta en **resend.com** (gratis, 3,000 correos al mes).
2. **Domains → Add Domain →** `luxegaragee.com`. Copia los registros que te da a Hostinger → Editor de zona DNS, **sin borrar** los que ya existen. Espera a que diga **Verified**.
3. **API Keys → Create**. En Vercel:
   - `RESEND_API_KEY` (Secret)
   - `MAIL_FROM` = `LUXE GARAGE <reservas@luxegaragee.com>`
   - `MAIL_TO_ADMIN` = el correo del negocio
4. **Redeploy**.

## 4. Plan de Vercel
- [ ] El plan **Hobby** no permite uso comercial. Para cobrar: plan **Pro**.

## 5. Apple Pay (opcional, después)
1. Cuenta **Apple Developer Program** (empresa).
2. Crear **Merchant ID** y certificados según la guía de Mercado Pago (Apple Pay México).
3. Verificar el dominio: mándame el archivo `apple-developer-merchantid-domain-association` y lo publico en `/.well-known/`.
4. Yo integro el botón (solo aparece en Safari con Wallet).

## 6. Legal
- [ ] El abogado revisa el **aviso de privacidad** (`/privacidad`): LFPDPPP 2025, menciona Mercado Pago, Resend, Vercel y Upstash.
- [ ] Definir la política de **cancelación y reembolso**. Hoy el reembolso se hace a mano en Mercado Pago.

## 7. Pendientes técnicos (para la siguiente sesión)
- [ ] Prueba completa con **Redis real** del apartado atómico (scripts Lua) y de la membresía de punta a punta. Se interrumpió para ahorrar créditos; en modo memoria sí pasó.
- [ ] Capturas y pulido visual en iPhone y computadora.
- [ ] Renovación automática de la membresía cada mes (hoy es un pago único por 30 días).
- [ ] Decidir si "Solo exterior" cuesta menos (hoy cuesta lo mismo que exterior e interior).
- [ ] Decidir si a domicilio debe bloquear tiempo extra de traslado (hoy bloquea solo la duración del servicio).
- [ ] Crear la rama `main` para producción y trabajar en ramas aparte.
- [ ] Opcional: `.claude/settings.json` y el hook de secretos (requieren tu aprobación).

## Datos útiles
- Contraseña del panel: la que acordamos en el chat (no se guarda en el repositorio). Para cambiarla: variable `ADMIN_PASSWORD` en Vercel.
- Teléfono del negocio: +52 56 6500 6823.
- Horario: lunes a jueves de 12 pm a 7 pm · viernes y sábado de 1 pm a 6 pm · domingo cerrado (se edita en Panel → Ajustes).
- Pasos detallados de Vercel: `docs/VERCEL.md`.
