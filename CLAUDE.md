# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Themis is a SaaS platform for Argentine law firms. It manages clients, expedientes (case files), judicial deadlines, documents, billing (facturas), and calendar events. Subscriptions are handled via MercadoPago recurring payments.

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

### Run backend tests (verbose)

```bash
cd backend && npx jest --verbose
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

- **auth** — JWT (60 min expiry) + Passport local strategy. OTP-via-WhatsApp for password recovery. `AuthController` exposes `/auth/login`, `/auth/register`. **OTPs are stored in the database (`Otp` entity)**, preventing recovery session loss on server restarts.
- **users** — `User` entity is the tenant root. Every client and expediente belongs to a `User`. Roles: `USER` | `ADMIN`. Auto-seeds `admin@themis.com` on bootstrap via `SeedService`.
- **clients / expedientes** — Core legal domain. Expedientes track `EstadoExpediente`: `INICIADO → PRUEBA → ALEGATOS → SENTENCIA → ARCHIVADO`. Both support **server-side pagination, status filters, and search queries**.
- **deadlines** — Judicial vencimientos. Exposes `/deadlines` and `/deadlines/analyze-pdf` to upload a judicial notification PDF and extract/schedule upcoming deadline calendar events using Gemini 2.5 Flash by default. A daily cron job runs at 9 AM to send WhatsApp alerts.
- **calendar** — Empty module. Google Calendar integration was removed. Controller has no endpoints.
- **documents** — **File uploads are persisted in Cloudinary** (avoiding local ephemeral filesystem issues on Render). Safe streaming view/download endpoints are protected by `JwtAuthGuard` to mask public Cloudinary URLs.
- **mercadopago** — Recurring subscriptions (`PreApproval`). Webhook at `POST /mercadopago/webhook` updates `subscriptionStatus` and `subscriptionExpiresAt` on the User entity.
- **whatsapp** — `whatsapp-web.js` session with RemoteAuth. Session stored in PostgreSQL (`whatsapp_sessions` table) to prevent Render ephemeral restarts from wiping authentication. Initializes 8 seconds after app start.
- **facturas** — AFIP/ARCA e-invoicing. Uses `os.tmpdir()` for cross-platform (Windows dev / Linux prod) temp certificate writing, and reads `AFIP_PRODUCTION` env variable dynamically to switch between homologation (false/default) and production. Falls back to simulation mode if `AFIP_CERT`/`AFIP_KEY` env vars are missing.
- **movimientos** — Financial movements per client (honorarios, gastos, pagos) with JUS/UMA unit support.
- **settings** — Key-value config store. Seeded with `VALOR_JUS_ENTRE_RIOS`, `VALOR_UMA_NACION`, `ENABLE_WHATSAPP`, `DAYS_BEFORE_ALERT`, `ENABLE_DESKTOP_NOTIFICATIONS`.
- **ai** — **Copiloto Themis module**. Exposes `/ai/analyze`, `/ai/draft`, `/ai/summarize-expediente`, and `/ai/analyze-risk` protected by `JwtAuthGuard`. Leverages Google Gemini 2.5 Flash (free tier) via `GEMINI_API_KEY` (or dynamically configured using `GEMINI_MODEL`) with automated fallback to OpenAI (`gpt-4o-mini`) if `OPENAI_API_KEY` is set.

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
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — Cloudinary uploads
- `AI_ENABLED` (`true` / `false`) — enables Copiloto IA
- `OPENAI_API_KEY` — OpenAI API key
- `AFIP_CUIT` — Taxpayer CUIT for AFIP billing
- `AFIP_CERT` — Content of AFIP certificate file (.crt)
- `AFIP_KEY` — Content of AFIP private key file (.key)
- `AFIP_PRODUCTION` (`true` / `false`) — switches AFIP environment between homologation and production
- `MP_WEBHOOK_SECRET` — Webhook secret signature key from MercadoPago

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
| Auth (BE+FE)        | 100%    | OTPs persisted in PostgreSQL.                                             |
| Clientes            | 99%     | Server-side pagination fully integrated.                                  |
| Expedientes         | 99%     | Server-side pagination and state filter fully integrated.                 |
| Calendario          | 99%     | Integrated client-side Native Browser notifications and in-app SweetAlert2 scheduler for calendar events and deadlines. |
| Profile             | 100%    | WhatsApp session persisted in DB using RemoteAuth (session ID: `themis-session`); AFIP dynamic env configuration. |
| Subscription UI     | 95%     | — |
| Dashboard           | 99%     | — |
| Admin/Users         | 99%     | — |
| Documents UI        | 99%     | Cloudinary integration completed; preview modal resolved.                 |
| Copiloto Themis     | 100%    | Premium AI module fully implemented (general text analysis, automatic judicial drafts, case summaries, and risk/success analysis dashboards). |
| Calendar (BE)       | 100%    | Service Worker Deep Background Push Notifications implemented using VAPID keys. |
| Facturas y Audits   | 99%     | Server-side pagination implemented for invoices (Facturas) and system logs (AuditLogs). |

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
- **SeedService**: Creates `admin@themis.com` automatically on startup if it does not exist. Password from env `ADMIN_PASSWORD`.
- **Storage efímero en Render**: Cloudinary handles document uploads. WhatsApp auth session is now persisted in PostgreSQL via a custom `WhatsappDbStore` with `RemoteAuth` under key `RemoteAuth-themis-session`, solving the Render ephemeral restarts issue.
- **synchronize:true en prod**: TypeORM crea/altera tablas al iniciar. Cambios de columna pueden perder datos. No usar para eliminar columnas — hacerlo manualmente en la DB.
- **Hardcoded values a recordar**:
  - MercadoPago: monto `15000 ARS` en `mercadopago.service.ts`
  - Expedientes: límite de 30 en plan básico hardcodeado en el template frontend
  - Grace period: `7 * 24 * 60 * 60 * 1000` ms en `subscription.guard.ts` y `auth.service.ts` — mantener en sync
  - CORS: origins hardcodeados en `backend/src/main.ts`
- **Tests**: Jest unit test suite has been added for clients pagination, AI activation/fallback logic, and database OTP persistence. Run `npx jest --verbose` in `backend` folder to execute (all 10 tests passing).
- **whatsapp-auth/ in .gitignore**: `backend/whatsapp-auth/` is ignored by `.gitignore` in the repository root to prevent committing chromium session cache.
- **OTP con crypto.randomInt**: Los OTPs usan `import { randomInt } from 'crypto'` (no `Math.random()`). Límite de 5 intentos fallidos antes de invalidar — y están guardados en la tabla `otps` de PostgreSQL.
- **Documents service usa userId**: `findAll`, `findOne`, `remove`, `create` reciben `userId` para ownership. El controller extrae `req.user.userId` del JWT.
- **Kanban: detectar columna por referencia**: `this.columns.find(c => c.items === event.container.data)` es más robusto que `event.container.id` (CDK puede devolver ID interno).
- **chart.js instalado**: `legal-tech-app` tiene `chart.js ^4.5.1` + `ChartModule` de PrimeNG para el dashboard.
- **Auth endpoints públicos**: `/auth/forgot-password` y `/auth/reset-password` no requieren JWT. OTPs keyed por `forgot_<email>` para no colisionar con los del perfil.

---

## Recommended Next Steps & Innovative Ideas

### Next Steps:
1. **Configure API Keys in Production**: Add `GEMINI_API_KEY` on Render to fully run the integrated AI copilot and PDF parsing features for free, or add `OPENAI_API_KEY` if preferred.
2. **AFIP Point of Sale Configuration**: Allow configuring custom points of sale from the user profile settings.
3. **Lazy-Loaded Account Movements**: Implement server-side pagination for movement lists (cuenta corriente).

### Innovative Feature Ideas:
1. **Two-Way Client WhatsApp Bot**: Clients query their case files by text message (e.g., `"status"`) and the bot responds with case details.
2. **Judicial Interest Calculator**: Integrates provincial/national interest tables to calculate updates and output PDFs.
3. **Predictive Trial Cost Analysis**: Estimate justice fees, minimum legal fees, and administrative expenses before filing to provide precise client quotes.
