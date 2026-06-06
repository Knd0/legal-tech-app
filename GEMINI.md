# GEMINI.md

Este archivo contiene el registro de contexto de **Gemini** (Antigravity AI) sobre la arquitectura, estado actual e integraciones de la plataforma **Themis**. Sirve como guía de alineación y referencia rápida de desarrollo.

---

## 🏗️ Estructura del Repositorio

- **`backend/`** — API REST en **NestJS** (Puerto 3000)
- **`legal-tech-app/`** — Frontend SPA en **Angular 21** (Puerto 4200)

---

## 🔑 Estado de Base de Datos y Cuentas Locales

- **PostgreSQL Local:** Activo en `localhost:5432`.
- **Credenciales:** `postgres` / `1234`
- **Base de datos:** `legal_tech_db`
- **Cuentas Sembradas (`SeedService` & script manual con contraseña `password123`):**
  1. `admin@themis.com` (Rol: `ADMIN` — bypass de checks de suscripción).
  2. `multifranco0@gmail.com` (Rol: `USER` — 2 clientes y 2 expedientes de prueba).
  3. `admin@estudio.com` (Rol: `USER` — 1 cliente y 2 expedientes de prueba).

---

## 📈 Completitud y Estado de Módulos

Actualmente la aplicación se encuentra en un estado muy avanzado (~99% global):

| Area | Estado | Detalles de Implementation |
|---|---|---|
| **Auth (BE+FE)** | **100%** | JWT (60m) + local strategy. Recuperación por OTP vía WhatsApp (y fallback a Email vía Resend) **persistido en base de datos (`Otp` entity)** para resistir reinicios en Render. |
| **Clientes** | **99%** | Gestión completa. Tabla con **paginación server-side, debouncer de búsqueda (300ms) y carga lazy**. Reemplazado confirm() nativo por SweetAlert2. |
| **Expedientes** | **99%** | Seguimiento de causas. Tabla con **paginación server-side, filtro de estado, debouncer y borrado con SweetAlert2**. Kanban interactivo funcional. |
| **Calendario** | **99%** | Vista interactiva en frontend (mensual/semanal/diario). Módulo backend (Calendar BE) implementado con eventos en base de datos. Integrado sistema de alertas pop-up nativas (PC/Celular) y en la misma app (SweetAlert2) para eventos y vencimientos de hoy/próximos. |
| **Profile** | **100%** | Edición de perfil, configuración de alertas, vinculación de WhatsApp (QR/Código) y AFIP. **Persistencia de sesión de WhatsApp Web en PostgreSQL (`whatsapp_sessions`) usando RemoteAuth.** |
| **Subscription UI**| **99%** | Verificación real del pago en success page: llama a `GET /mercadopago/subscription`, actualiza el signal de auth, muestra estados success/pending/failure con botón de reintento. |
| **Dashboard** | **99%** | Estadísticas y métricas financieras usando PrimeNG Charts y Chart.js (`chart.js ^4.5.1`). |
| **Admin/Users** | **99%** | Listado de usuarios, suspensión y borrado estilizado con SweetAlert2. |
| **Documents UI** | **99%** | Carga de archivos integrada con **persistencia real en la nube usando Cloudinary**. Streaming seguro (view/download) y preview interactivo de imágenes y PDFs. |
| **Copilot** | **100%** | Módulo de IA premium: análisis de textos, redactor de escritos judiciales, resúmenes procesales, análisis de riesgo/probabilidad de éxito. Gemini 2.5 Flash por defecto, fallback a OpenAI. |
| **Facturas y Auditorías**| **99%** | Paginación server-side en facturas y audit logs. |

---

## 🔒 Seguridad

Todos los gaps de seguridad conocidos están cerrados (JWT guards, filtros por userId, HMAC-SHA256 en webhook de MP, XSS/Header Injection en documents, Mass Assignment en calendar). Ver detalle completo en CLAUDE.md.

---

## 🐛 Bugs y Pendientes (Audit QA — 2026-06-06)

### Críticos
~~- **`main.ts:5-7`** — 3x `console.log` eliminados. ✓~~
~~- **`mercadopago.service.ts:48,72`** — `back_url` movida a `configService.get('FRONTEND_URL')` con fallback. ✓~~
~~- **`home.component.html`** — Archivo orphanado; la ruta `/` usa el componente `Landing` real. ✓~~
~~- **`environment.prod.ts:4`** — VAPID key regenerada con `npx web-push generate-vapid-keys`. ✓~~

### Alta prioridad
~~- **`login.html`, `register.html`, `forgot-password.html`** — Botones migrados a `<button pButton>` con `[loading]` nativo de PrimeNG. ✓~~
~~- **`app.module.ts:37-40`** — `console.log` de debug eliminados del backend. ✓~~
~~- **`login.html`** — Campo contraseña ahora muestra mensaje de error de validación con `<small>`. ✓~~

### Media prioridad
~~- **`expediente.service.ts`, `client.service.ts`, `deadline.service.ts`, `calendar-event.service.ts`** — Reemplazados `console.error` con `Swal.fire` toast en todos los handlers de error HTTP. ✓~~
~~- **`register.html`** — Agregado hint estático con requisitos de contraseña debajo del campo. ✓~~
~~- **`mercadopago.service.ts:55`** — Comentario stale eliminado. ✓~~

---

## ⚙️ Variables de Entorno Clave

### Backend (`.env`):
- `DB_HOST=localhost`, `DB_PORT=5432`, `DB_USERNAME=postgres`, `DB_PASSWORD=1234`, `DB_DATABASE=legal_tech_db`
- `JWT_SECRET=super_secret_jwt_key`
- `PORT` (por defecto 3000)
- `MP_ACCESS_TOKEN` (Producción/Pruebas de MercadoPago)
- `MP_WEBHOOK_SECRET` (Firma de Webhooks de MercadoPago — **pendiente en Render**)
- `RESEND_API_KEY` (Para envío de correos en flujo de olvido de clave — **pendiente en Render**; sin esta variable el fallback a email no funciona, WhatsApp sigue andando normalmente)
- `FRONTEND_URL` (URL del frontend — ya se usa en el código; configurar en Render para que `back_url` de MercadoPago apunte correctamente)
- `VAPID_PUBLIC_KEY` — clave pública generada. Sin esta variable el backend genera claves efímeras en cada restart, invalidando suscripciones push.
- `VAPID_PRIVATE_KEY` — clave privada correspondiente. Guardar también en `.env` local.
- `ADMIN_PASSWORD` (Seed del admin, por defecto `ChangeMe123!`)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (Almacenamiento persistente de archivos)
- `AI_ENABLED` (`true` / `false` — activa o desactiva el Copiloto IA)
- `GEMINI_API_KEY` (Clave de Google Gemini, tier gratuito vía Google AI Studio)
- `GEMINI_MODEL` (Override del modelo; por defecto `gemini-2.5-flash`)
- `OPENAI_API_KEY` (Clave de API de OpenAI — fallback si Gemini no está configurado)
- `AFIP_CUIT` (CUIT del contribuyente para vinculación con ARCA/AFIP)
- `AFIP_CERT` (Contenido del certificado `.crt` de AFIP)
- `AFIP_KEY` (Contenido de la clave privada `.key` de AFIP)
- `AFIP_PRODUCTION` (`true` / `false` — define si la facturación de AFIP opera en entorno de producción o de homologación/prueba)

---

## 🧩 Patterns & Gotchas

- **Signals vs RxJS**: Usar `signal()` y `computed()` para nuevo estado en el frontend. Suscribirse a Observables HTTP con `.subscribe()` está bien, pero no crear `BehaviorSubject` nuevos — convertir a signal en el `tap`/`next`.
- **Audit logging**: Los módulos clients/expedientes/movimientos hacen audit logging de forma asíncrona sin `await` ni `try/catch` — puede fallar silenciosamente. No agregar awaits sin manejar el error.
- **SeedService**: Crea `admin@themis.com` automáticamente al iniciar si no existe. Contraseña desde env `ADMIN_PASSWORD`.
- **synchronize:true en prod**: TypeORM crea/altera tablas al iniciar. Cambios de columna pueden perder datos. No usar para eliminar columnas — hacerlo manualmente en la DB.
- **Hardcoded values a recordar**:
  - MercadoPago: monto `15000 ARS` en `mercadopago.service.ts`
  - Expedientes: límite de 30 en plan básico hardcodeado en el template frontend
  - Grace period: `7 * 24 * 60 * 60 * 1000` ms en `subscription.guard.ts` y `auth.service.ts` — mantener en sync
  - CORS: origins hardcodeados en `backend/src/main.ts`
- **Tests**: Suite Jest agregada para paginación de clientes, activación/fallback de IA y persistencia de OTPs en DB. Ejecutar `npx jest --verbose` en carpeta `backend` (todos los 10 tests pasan).
- **OTP con crypto.randomInt**: Los OTPs usan `import { randomInt } from 'crypto'` (no `Math.random()`). Límite de 5 intentos fallidos antes de invalidar — guardados en tabla `otps` de PostgreSQL.
- **Kanban: detectar columna por referencia**: `this.columns.find(c => c.items === event.container.data)` es más robusto que `event.container.id` (CDK puede devolver ID interno).
- **Auth endpoints públicos**: `/auth/forgot-password` y `/auth/reset-password` no requieren JWT. OTPs keyed por `forgot_<email>` para no colisionar con los del perfil.
- **whatsapp-auth/ en .gitignore**: `backend/whatsapp-auth/` ignorado por `.gitignore` para no commitear el caché de sesión de Chromium.

---

## 🔧 Regla de Mantenimiento

**Actualizar este archivo después de cada fix.** Cuando se resuelve un bug o se completa una mejora:

- Borrar o tachar el ítem de Known Bugs / Security Gaps
- Actualizar el porcentaje y próximo paso en Module Completeness
- Nunca dejar referencias a problemas ya resueltos sin aclarar su estado

---

## 💡 Próximos Pasos Recomendados

1. **Configurar la API Key del Copilot en Producción (Render):**
   El módulo está 100% desarrollado. Para activarlo de forma gratuita en producción, obtenga una API key en Google AI Studio (https://aistudio.google.com/) y configúrela como variable de entorno `GEMINI_API_KEY` en Render.
2. **Soporte para múltiples Puntos de Venta en AFIP:**
   Permitir a los usuarios configurar diferentes números de Punto de Venta directamente en su perfil de configuración para mayor flexibilidad en la emisión de facturas.
3. **Paginación Server-Side en listados de Movimientos (Cuenta Corriente):**
   Si la cantidad de transacciones por cliente se incrementa fuertemente, se puede aplicar paginación diferida en la lista principal de movimientos del cliente.

---

## 🚀 Ideas Innovadoras para el Futuro

1. **Bot de WhatsApp Bidireccional (Interactivo para Clientes):**
   Habilitar que los clientes del estudio jurídico puedan enviarle un mensaje al bot de WhatsApp (ej. `"estado"`) y el bot responda de forma automática con el estado actual del expediente y los últimos movimientos públicos permitidos.
2. **Cálculo Automático de Actualizaciones Judiciales (Calculadora de Intereses Compleja):**
   Integrar una calculadora financiera avanzada con tasas de interés oficiales de distintos fueros y provincias (ej. Tasa Activa del Banco Nación, Tasa Pasiva de Buenos Aires, etc.) para liquidar intereses de forma interactiva y exportar el reporte en PDF.
3. **Análisis Predictivo de Costos del Juicio:**
   Estimar de forma interactiva la tasa de justicia, bonos, honorarios mínimos de ley y gastos administrativos estimados antes de iniciar la demanda para cotizar mejor a los clientes.

