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
| `ADMIN_SESSION_SECRET` | Texto aleatorio de **32+ caracteres**. Generar con `openssl rand -base64 48` o con 1Password. |

Nunca pegues estos valores en el chat ni en el repositorio.

## 4. Volver a desplegar
Deployments → último despliegue → **Redeploy** (las variables nuevas solo aplican a despliegues nuevos).

## 5. Usarlo
- Sitio: `https://<tu-dominio>/`
- Panel: `https://<tu-dominio>/admin`
  - Botones **Libre / Ocupado / Bloqueado**: la web se actualiza en ~2–5 s.
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
