# Publicar y controlar LUXE GARAGE en Vercel

## 1. Proyecto
El proyecto de Vercel `luxe-garage` está conectado a este repositorio.
- Cada `git push` a una rama crea un despliegue **Preview** con su propia URL.
- La rama `main` es **Production**.

## 2. Almacenamiento (1 clic)
Vercel → proyecto `luxe-garage` → **Storage** → **Create Database** → **Upstash for Redis** (plan gratis) → conectar al proyecto en *Production, Preview y Development*.

Vercel crea solas las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`. No hay que copiarlas a ningún lado.

> Si el prefijo que elige Vercel es distinto (p. ej. `UPSTASH_REDIS_REST_URL`), también funciona: el código acepta ambos.

## 3. Variables del panel
Vercel → **Settings → Environment Variables** → marcar **Sensitive**:

| Variable | Valor |
|---|---|
| `ADMIN_PASSWORD` | Tu contraseña del panel, **mínimo 12 caracteres**. |
| `ADMIN_SESSION_SECRET` | *Opcional.* Si no la pones, se genera sola a partir de la contraseña y la clave de Upstash. |

Nunca pegues estos valores en el chat ni en el repositorio.

## 4. Volver a desplegar
Deployments → último despliegue → **Redeploy** (las variables nuevas solo aplican a despliegues nuevos).

## 5. Usarlo
- Sitio: `https://<tu-dominio>/`
- Panel: `https://<tu-dominio>/admin`
  - Interruptor **Negocio: Abierto / Cerrado** → cerrado baja la cortina de acero en la página.
  - Interruptor **Fosa: Libre / Ocupado** → cambia el semáforo (flecha verde / ✕ roja) y mete o saca el auto. La web se actualiza en ~2–5 s.
  - Arriba ves el semáforo tal como lo ve el cliente.
  - **Precios, lavadas por mes, horario, días y aviso**: al guardar, la página pública se regenera al instante.
  - Si ves la franja amarilla “Almacenamiento temporal”, falta el paso 2.

## 6. Recomendado
- **Deployment Protection** para Preview (Settings → Deployment Protection).
- Plan **Hobby** es solo para uso no comercial; para cobrar con Mercado Pago, plan **Pro** y dominio propio.
- 2FA en Vercel, GitHub y Upstash.

## Cómo resiste fallas
- La página principal es estática: si Redis se cae, sigue sirviendo la última versión buena.
- El estado en vivo pasa por la caché de Vercel 2 s: muchos visitantes ≈ 1 lectura cada 2 s.
- Si el estado no se puede leer, el hero dice “Reconectando…” en vez de mostrar algo falso.
- El login se bloquea 15 min tras 5 intentos por IP.

## 7. Cobrar con Mercado Pago
1. mercadopago.com.mx/developers → **Tus integraciones** → **Crear aplicación** (pagos en línea, Checkout API).
2. En la aplicación → **Credenciales de prueba** (primero prueba, luego producción):
   - **Public Key** → variable `NEXT_PUBLIC_MP_PUBLIC_KEY` (tipo *Config*: es pública).
   - **Access Token** → variable `MP_ACCESS_TOKEN` (tipo *Secret*).
3. En la aplicación → **Webhooks** → URL `https://luxegaragee.com/api/mp/webhook`, evento **Pagos** → guardar.
   Copia la **clave secreta** → variable `MP_WEBHOOK_SECRET` (tipo *Secret*).
4. **Redeploy** (la Public Key se incrusta al construir).
5. Prueba con las tarjetas de prueba de Mercado Pago. Cuando todo funcione, cambia a las credenciales de **producción**.

Mientras falten estas variables, la página muestra "Pagos en línea en activación" y no aparta horarios.
