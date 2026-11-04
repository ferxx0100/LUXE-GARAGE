# LUXE GARAGE — Lo que falta

Estado: la versión con socios (cuenta con celular + NIP y cobro mensual) está en `claude/happy-volta-ptpo2f`. Ya incluye lo que había en producción (`claude/busy-noether-my8mwr`). Se publica cuando lo autorices.
Sitio: https://luxegaragee.com · Cuenta de socio: https://luxegaragee.com/socio · Panel: https://luxegaragee.com/admin

---

## 1. Revisar en tu iPhone
Probado en local de punta a punta con un Mercado Pago simulado. Falta probarlo contra el Mercado Pago real.
- [ ] Portada: LIBRE / OCUPADO / CERRADO con rangos ("Ocupado 4:00–4:30"), botones "Apartar 4:30–5:00" y "Otro día u hora".
- [ ] Hazte socio: carro $399 / camioneta $519 → nombre, celular, NIP → pago → entra solo a su cuenta.
- [ ] Cuenta de socio: tarjeta con sello vivo, 4 casillas, apartar, "Estoy aquí: lavar ahora", cancelar con más de 72 h.
- [ ] Lavada suelta: carro $120 / camioneta $250, pago con tarjeta o "Pagar con Mercado Pago".
- [ ] Panel del empleado (`STAFF_PASSWORD`): solo "Hoy" con sello, abrir/cerrar, libre/ocupado.
- [ ] Panel del dueño: Hoy, Agenda, Socios (nuevo NIP) y Ajustes (precios, tope de 45, lavadas, horario).

## 2. Mercado Pago (cobros reales)
Variables en Vercel → Settings → Environment Variables (solo **Production**):

| Variable | De dónde | Tipo |
|---|---|---|
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | Public Key | Config |
| `MP_ACCESS_TOKEN` | Access Token | Sensitive |
| `MP_WEBHOOK_SECRET` | Webhooks → URL `https://luxegaragee.com/api/mp/webhook` → clave secreta | Sensitive |
| `STAFF_PASSWORD` | Contraseña del empleado (mínimo 8, distinta a la tuya) | Sensitive |

En **Webhooks** marca los eventos **Pagos** y **Planes y suscripciones** (cobro mensual de los socios). Sin la clave del webhook, los socios igual se activan al pagar (la cuenta consulta a Mercado Pago), pero las renovaciones se ven hasta que el socio abre su cuenta.

**Primera prueba real:** hazte socio tú con tu tarjeta ($399), revisa tu cuenta y el panel, y cancela la membresía desde tu cuenta. Revisa en Mercado Pago que se canceló la suscripción y devuelve el cobro si quieres.

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

## 5. Apple Pay
Ya se puede pagar con tarjeta y con el botón **"Pagar con Mercado Pago"** (cuenta del cliente: tarjetas guardadas o saldo).
Para agregar Apple Pay, Mercado Pago pide (guía "Apple Pay" en developers de Mercado Pago México):
1. Cuenta **Apple Developer Program** a nombre del negocio.
2. Crear un **Merchant ID** y los **certificados** que indica la guía, y cargarlos en tu aplicación de Mercado Pago.
3. Verificar el dominio `luxegaragee.com`: mándame el archivo `apple-developer-merchantid-domain-association` y lo publico en `/.well-known/`.
4. Yo integro el botón con el SDK de Mercado Pago (solo aparece en iPhone/Safari con Wallet).

**Ojo con las credenciales:** si las de producción también están en "Preview" de Vercel, un pago en la vista previa es un cobro real. Lo correcto: credenciales de prueba en Preview y de producción solo en Production.

## 6. Legal
- [ ] El abogado revisa el **aviso de privacidad** (`/privacidad`): LFPDPPP 2025, menciona Mercado Pago, Resend, Vercel y Upstash.
- [ ] Definir la política de **cancelación y reembolso**. Hoy el reembolso se hace a mano en Mercado Pago.

## 7. Pendientes técnicos (para la siguiente sesión)
- [ ] Prueba completa con **Redis real** del apartado atómico (scripts Lua) y de la membresía de punta a punta. Se interrumpió para ahorrar créditos; en modo memoria sí pasó.
- [ ] Capturas y pulido visual en iPhone y computadora.
- [ ] Renovación automática de la membresía cada mes (hoy es un pago único por 30 días).
- [ ] Apple Wallet (pase .pkpass): requiere Apple Developer Program y un certificado "Pass Type ID". Hoy el ticket se guarda como imagen y llega por correo.
- [ ] Decidir si "Solo exterior" cuesta menos (hoy cuesta lo mismo que exterior e interior).
- [ ] Decidir si a domicilio debe bloquear tiempo extra de traslado (hoy bloquea solo la duración del servicio).
- [ ] Crear la rama `main` para producción y trabajar en ramas aparte.
- [ ] Opcional: `.claude/settings.json` y el hook de secretos (requieren tu aprobación).

## Datos útiles
- Contraseña del panel: la que acordamos en el chat (no se guarda en el repositorio). Para cambiarla: variable `ADMIN_PASSWORD` en Vercel.
- Teléfono del negocio: +52 56 6500 6823.
- Horario: lunes a jueves de 12 pm a 7 pm · viernes y sábado de 1 pm a 6 pm · domingo cerrado (se edita en Panel → Ajustes).
- Pasos detallados de Vercel: `docs/VERCEL.md`.
