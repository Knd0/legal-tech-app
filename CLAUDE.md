# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LegalTech is a SaaS platform for Argentine law firms. It manages clients, expedientes (case files), judicial deadlines, documents, billing (facturas), and calendar events. Subscriptions are handled via MercadoPago recurring payments.

## Repository Layout

```
backend/          # NestJS REST API (port 3000)
legal-tech-app/   # Angular 21 frontend (port 4200)
```

## Commands

### Backend (from `backend/`)

```bash
npm run start:dev     # Dev server with hot reload
npm run build         # Compile TypeScript via tsc
npm run lint          # ESLint with auto-fix
npm test              # Jest unit tests
npm run test:e2e      # End-to-end tests
```

### Frontend (from `legal-tech-app/`)

```bash
npm start             # ng serve (dev)
npm run build         # Production build
npm test              # Vitest tests
```

### Run a single backend test

```bash
cd backend && npx jest src/path/to/file.spec.ts
```

### Local database (Docker)

```bash
cd backend && docker-compose up -d
```

## Architecture

### Backend (NestJS)

Each feature is a NestJS module under `backend/src/`. Key modules:

- **auth** — JWT (60 min expiry) + Passport local strategy. OTP-via-WhatsApp for password recovery. `AuthController` exposes `/auth/login`, `/auth/register`. OTP stored in-memory (lost on restart).
- **users** — `User` entity is the tenant root. Every client and expediente belongs to a `User`. Roles: `USER` | `ADMIN`. Auto-seeds `admin@legaltech.com` on bootstrap via `SeedService`.
- **clients / expedientes** — Core legal domain. Expedientes track `EstadoExpediente`: `INICIADO → PRUEBA → ALEGATOS → SENTENCIA → ARCHIVADO`.
- **deadlines** — Judicial vencimientos. Cron job in `NotificationsModule` runs daily at 9 AM to send WhatsApp alerts for upcoming deadlines.
- **calendar** — Empty module. Google Calendar integration was removed. Controller has no endpoints.
- **documents** — File uploads via Multer to `./uploads/` on local disk (ephemeral on Render — files lost on redeploy).
- **mercadopago** — Recurring subscriptions (`PreApproval`). Webhook at `POST /mercadopago/webhook` updates `subscriptionStatus` and `subscriptionExpiresAt` on the User entity.
- **whatsapp** — `whatsapp-web.js` session with LocalAuth. Session stored in `./whatsapp-auth/` (ephemeral on Render). Initializes 8 seconds after app start.
- **facturas** — AFIP/ARCA e-invoicing. Falls back to simulation mode if `AFIP_CERT`/`AFIP_KEY` env vars are missing.
- **movimientos** — Financial movements per client (honorarios, gastos, pagos) with JUS/UMA unit support.
- **settings** — Key-value config store. Seeded with `VALOR_JUS_ENTRE_RIOS`, `VALOR_UMA_NACION`, `ENABLE_WHATSAPP`, `DAYS_BEFORE_ALERT`.

Database: PostgreSQL via TypeORM. `synchronize: true` in both dev and prod — schema changes apply on boot. No migration files exist.

Backend deployed on Render: `https://legal-tech-app-gdme.onrender.com`

### Frontend (Angular 21)

State management uses **Angular Signals** — no NgRx. The `AuthService` (`core/services/auth.service.ts`) holds `currentUser` as a writable signal with computed signals:

- `isSubscriptionExpired` — true if `subscriptionExpiresAt` is past
- `isGracePeriod` — 7-day window after expiry; read allowed, creation blocked
- `isCreationBlocked` — gates all create/edit actions in components

Route guards: `authGuard`, `guestGuard`, `subscriptionGuard` (redirects past-grace-period users to `/subscription/pricing`), `AdminGuard`.

UI: **PrimeNG 21** + **Tailwind CSS 3**. Alerts via **SweetAlert2** (use this, not `alert()`). PDF via **jsPDF + jspdf-autotable**. Excel via **xlsx**.

Frontend deployed on Vercel: `https://legal-tech-app-woad.vercel.app`

### Subscription Logic

7-day grace period enforced in two places:

1. `subscriptionGuard` (`core/guards/subscription.guard.ts`) — controls route access
2. `authService.isCreationBlocked()` — component-level gate on create/edit actions

`ADMIN` role bypasses all subscription checks.

### Environment Variables

Backend (`.env`):

- `DATABASE_URL` or (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`)
- `JWT_SECRET`
- `MP_ACCESS_TOKEN` — MercadoPago
- `ADMIN_PASSWORD` — seed password for admin user (defaults to `ChangeMe123!`)
- `PORT` (default 3000)

Frontend: `environment.ts` → `http://localhost:3000`; `environment.prod.ts` → Render URL.

---

## Known Bugs

No hay bugs confirmados pendientes.

---

## Security Gaps

Todos los gaps conocidos han sido corregidos:

- ~~`deadlines.controller.ts`~~ — **ARREGLADO**: `@UseGuards(JwtAuthGuard)` + filtro por `userId` en service
- ~~`documents.controller.ts`~~ — **ARREGLADO**: guard + `userId` en entidad `Documento` + filtro en service
- ~~`whatsapp.controller.ts`~~ — **ARREGLADO**: `@UseGuards(JwtAuthGuard)` en todos los endpoints
- ~~`mercadopago.controller.ts` webhook~~ — **ARREGLADO**: verificación HMAC-SHA256 con `MP_WEBHOOK_SECRET` env var (si no está configurada, loguea warning y permite — degradación grácil)

**Pendientes de configurar en Render** (Environment → Add Variable):

- `MP_WEBHOOK_SECRET` — valor en mercadopago.com.ar → Tu negocio → Configuración → Notificaciones → Webhooks → Clave secreta del webhook apuntando a `https://legal-tech-app-gdme.onrender.com/mercadopago/webhook`. Sin esta variable, el webhook acepta todas las requests sin verificar firma (loguea warning pero no rompe).
- `RESEND_API_KEY` — valor en resend.com → API Keys. Sin esta variable, el fallback a email en forgot-password no funciona (WhatsApp sigue andando normalmente).

---

## Module Completeness

| Área                | Estado  | Próximo paso                                                              |
| ------------------- | ------- | ------------------------------------------------------------------------- |
| Auth (BE+FE)        | 99%     | — |
| Clientes            | 85%     | Sin paginación server-side                                                |
| Expedientes         | 97%     | — |
| Calendario          | 97%     | — |
| Profile             | 99%     | — |
| Subscription UI     | 80%     | Sin historial de pagos; sin manejo del estado `paused` desde MercadoPago  |
| Dashboard           | 99%     | — |
| Admin/Users         | 99%     | — |
| Documents UI        | 78%     | Sin preview de archivos (PDF/imagen); archivos en disco efímero en Render — necesita S3 |
| Calendar (BE)       | 10%     | Módulo vacío; definir si reemplazar Google Calendar con eventos propios o eliminar |

---

## Regla de mantenimiento.

**Actualizar este archivo después de cada fix.** Cuando se resuelve un bug o se completa una mejora:

- Borrar o tachar el ítem de Known Bugs / Security Gaps
- Actualizar el porcentaje y próximo paso en Module Completeness
- Nunca dejar referencias a problemas ya resueltos sin aclarar su estado

---

## Patterns & Gotchas

- **Signals vs RxJS**: Usar `signal()` y `computed()` para nuevo estado en el frontend. Suscribirse a Observables HTTP con `.subscribe()` está bien, pero no crear `BehaviorSubject` nuevos — convertir a signal en el `tap`/`next`.
- **Audit logging**: Los módulos clients/expedientes/movimientos hacen audit logging de forma asíncrona sin `await` ni `try/catch` — puede fallar silenciosamente. No agregar awaits sin manejar el error.
- **SeedService**: Crea `admin@legaltech.com` automáticamente al iniciar el backend si no existe. Password desde env `ADMIN_PASSWORD`.
- **Storage efímero en Render**: Los archivos en `./uploads/` y la sesión de WhatsApp en `./whatsapp-auth/` se pierden al reiniciar el dyno. Cualquier feature de documentos real necesita S3 o similar.
- **synchronize:true en prod**: TypeORM crea/altera tablas al iniciar. Cambios de columna pueden perder datos. No usar para eliminar columnas — hacerlo manualmente en la DB.
- **Hardcoded values a recordar**:
  - MercadoPago: monto `15000 ARS` en `mercadopago.service.ts`
  - Expedientes: límite de 30 en plan básico hardcodeado en el template frontend
  - Grace period: `7 * 24 * 60 * 60 * 1000` ms en `subscription.guard.ts` y `auth.service.ts` — mantener en sync
  - CORS: origins hardcodeados en `backend/src/main.ts`
- **Tests**: Solo `core/services/plazos.service.spec.ts` tiene tests reales. El resto son scaffolds vacíos. No confiar en el test suite para verificar comportamiento.
- **OpenAI SDK**: Instalado en el backend pero no implementado. `core/services/ai.service.ts` en frontend es un stub que llama a `/ai/analyze`.
- **whatsapp-auth/ no está en .gitignore**: `backend/whatsapp-auth/` contiene sesión de Chromium que cambia sola. Antes de commitear, hacer `git restore --staged backend/whatsapp-auth/`. Pendiente: agregar al `.gitignore`.
- **OTP con crypto.randomInt**: Los OTPs usan `import { randomInt } from 'crypto'` (no `Math.random()`). Límite de 5 intentos fallidos antes de invalidar — aplica a ambos flujos (autenticado y forgot-password).
- **Documents service usa userId**: `findAll`, `findOne`, `remove`, `create` reciben `userId` para ownership. El controller extrae `req.user.userId` del JWT.
- **Kanban: detectar columna por referencia**: `this.columns.find(c => c.items === event.container.data)` es más robusto que `event.container.id` (CDK puede devolver ID interno).
- **chart.js instalado**: `legal-tech-app` tiene `chart.js ^4.5.1` + `ChartModule` de PrimeNG para el dashboard.
- **Auth endpoints públicos**: `/auth/forgot-password` y `/auth/reset-password` no requieren JWT. OTPs keyed por `forgot_<email>` para no colisionar con los del perfil.
