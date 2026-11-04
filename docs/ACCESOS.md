# LUXE GARAGE — Accesos y credenciales (dónde está cada cosa)

> Aquí van **solo nombres y lugares**, nunca valores. Las claves viven en Vercel (marcadas como *Sensitive*)
> o en la cuenta de cada servicio. Si alguien te pide que pegues una clave en un chat, no lo hagas.

## 1. Direcciones del sitio
| Qué | Dirección |
|---|---|
| Sitio público | https://luxegaragee.com (manda a https://www.luxegaragee.com) |
| Cuenta de socio | https://luxegaragee.com/socio |
| Panel (dueño y empleados) | https://luxegaragee.com/admin |
| Respaldo de Vercel | https://luxe-garage-gamma.vercel.app |

## 2. Quién entra al panel y cómo
| Persona | Cómo entra | Qué ve |
|---|---|---|
| **Dueño** | Su contraseña (variable `ADMIN_PASSWORD` en Vercel) | Todo: Hoy, Agenda, Socios, Equipo, Ajustes |
| **Empleado** | PIN de 6 números que le da el dueño en **Equipo** | Solo **Hoy**: abrir/cerrar, libre/ocupado, sellar y registrar lavadas |
| **Socio** | Su celular + NIP de 4 números (en /socio) | Su tarjeta, sus lavadas y apartar |

**¿Olvidaste la contraseña del dueño?** No está escrita en ningún lado (ni en el código ni aquí). Pon una nueva:
1. Vercel → proyecto **luxe-garage** → **Settings → Environment Variables**.
2. `ADMIN_PASSWORD` → **Edit** → escribe una nueva (mínimo 12 caracteres, solo tú la sabes) → entorno **Production** → **Save**.
3. **Deployments** → el primero → **⋯ → Redeploy**. Al terminar, entra a /admin con la nueva.

**Empleado nuevo o PIN olvidado:** /admin → **Equipo** → "Dar de alta" o "PIN nuevo". **Socio olvidó su NIP:** /admin → **Socios** → "Nuevo NIP".

## 3. Cuentas de servicios
| Servicio | Para qué | Dónde se administra |
|---|---|---|
| **GitHub** | Código (repositorio privado `ferxx0100/LUXE-GARAGE`) | github.com. Rama que se publica: `claude/busy-noether-my8mwr` |
| **Vercel** | Hospeda el sitio (plan Hobby) | vercel.com → equipo *ralf194399-4840's projects* → proyecto **luxe-garage** |
| **Hostinger** | Dominio `luxegaragee.com` y su DNS | hostinger.com → Dominios → luxegaragee.com → DNS |
| **Upstash Redis** | Base de datos (reservas, socios, pagos, historial) | Vercel → **Storage** (conectada al proyecto) |
| **Mercado Pago** | Cobros | mercadopago.com.mx/developers → **Tus integraciones** → la aplicación del negocio |

## 4. DNS en Hostinger (ya correcto, no tocar)
| Tipo | Nombre | Apunta a |
|---|---|---|
| A | `@` | `216.198.79.1` |
| CNAME | `www` | `cname.vercel-dns.com` |
| TXT | `_vercel` | verificación de Vercel para `www` (ya verificado) |

## 5. Variables en Vercel (Settings → Environment Variables)
| Variable | Qué es | De dónde sale | Tipo | Estado |
|---|---|---|---|---|
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | Public Key de Mercado Pago (puede ser pública) | MP → Tus integraciones → app → **Credenciales de producción** | Config, Production | ✅ puesta |
| `MP_ACCESS_TOKEN` | Access Token de Mercado Pago | El mismo lugar, **misma aplicación** que la Public Key | **Sensitive**, Production | ✅ puesta |
| `MP_WEBHOOK_SECRET` | Clave para confirmar avisos de pago | MP → app → **Webhooks** → URL `https://www.luxegaragee.com/api/mp/webhook`, eventos **Pagos** y **Planes y suscripciones** → "clave secreta" | **Sensitive**, Production | ⏳ falta |
| `ADMIN_PASSWORD` | Contraseña del dueño | La inventas tú | **Sensitive**, Production | ✅ puesta |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `REDIS_URL` | Base de datos | Las puso Vercel al conectar Upstash | automáticas | ✅ |
| `RESEND_API_KEY` | Correos de confirmación (opcional) | resend.com | **Sensitive**, Production | ⏳ opcional |
| `STAFF_PASSWORD` | Ya no hace falta: los empleados entran con su PIN | — | — | no usar |

Después de agregar o cambiar una variable: **Deployments → ⋯ → Redeploy** para que tome efecto.

## 6. Mercado Pago: revisar una vez
- En la aplicación: **Credenciales de producción activadas** y la Public Key + Access Token son de **esa misma** aplicación (ambas empiezan con `APP_USR-`).
- **Webhooks** (modo productivo): URL `https://www.luxegaragee.com/api/mp/webhook`, eventos **Pagos** y **Planes y suscripciones**.
- Cobros con tarjeta y suscripciones: la cuenta debe estar verificada (identidad y datos bancarios) para recibir dinero.
