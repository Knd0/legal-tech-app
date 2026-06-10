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
- **mercadopago** — Recurring subscriptions (`PreApproval`). Webhook at `POST /mercadopago/webhook` updates `subscriptionStatus` and `subscriptionExpiresAt` via `UsersService.updateSubscription()`, which writes to the `Subscription` entity.
- **whatsapp** — whatsapp-web.js session with RemoteAuth. Session stored in PostgreSQL (whatsapp_sessions table) to prevent Render/Railway ephemeral restarts from wiping authentication. Boots asynchronously in the background during application bootstrap (non-blocking) and is completely disabled in CLI/seeder/test environments to conserve RAM and prevent 504 Gateway Timeouts. Cache generation in Puppeteer is disabled via command-line arguments to minimize session size (~1.5MB).
- **facturas** — AFIP/ARCA e-invoicing. Uses `os.tmpdir()` for cross-platform (Windows dev / Linux prod) temp certificate writing, and reads `AFIP_PRODUCTION` env variable dynamically to switch between homologation (false/default) and production. Falls back to simulation mode if `AFIP_CERT`/`AFIP_KEY` env vars are missing.
- **movimientos** — Financial movements per client (honorarios, gastos, pagos) with JUS/UMA unit support.
- **settings** — Key-value config store. Seeded with `VALOR_JUS_ENTRE_RIOS`, `VALOR_UMA_NACION`, `ENABLE_WHATSAPP`, `DAYS_BEFORE_ALERT`, `ENABLE_DESKTOP_NOTIFICATIONS`.
- **ai** — **Copilot module**. Exposes `/ai/analyze`, `/ai/draft`, `/ai/summarize-expediente`, `/ai/analyze-risk`, and `/ai/analyze-costs` protected by `JwtAuthGuard`. Leverages Google Gemini 2.5 Flash (free tier) via `GEMINI_API_KEY` (or dynamically configured using `GEMINI_MODEL`) with automated fallback to OpenAI (`gpt-4o-mini`) if `OPENAI_API_KEY` is set.

Database: PostgreSQL via TypeORM. `synchronize: true` in both dev and prod — schema changes apply on boot. No migration files exist.

Backend deployed on Railway: `https://themis.up.railway.app`

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

1. `subscriptionGuard` (`core/guards/subscription.guard.ts`) — controls route access, delegates to `SubscriptionService.canAccessApp()`
2. `subscriptionService.isCreationBlocked()` — component-level gate on create/edit actions

Subscription state (`isSubscriptionExpired`, `isGracePeriod`, `isCreationBlocked`, `canAccessApp`) lives in `SubscriptionService` (`core/services/subscription.service.ts`), not in `AuthService`. `ADMIN` role bypasses all subscription checks.

### Environment Variables

Backend (`.env`):

- `DATABASE_URL` or (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`)
- `JWT_SECRET`
- `MP_ACCESS_TOKEN` — MercadoPago
- `ADMIN_PASSWORD` — seed password for admin user (defaults to `ChangeMe123!`)
- `PORT` (default 3000)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — Cloudinary uploads
- `AI_ENABLED` (`true` / `false`) — enables Copiloto IA
- `GEMINI_API_KEY` — Google Gemini API key (free tier via Google AI Studio)
- `GEMINI_MODEL` — override default model (defaults to `gemini-2.5-flash`)
- `OPENAI_API_KEY` — OpenAI API key (fallback if Gemini not configured)
- `RESEND_API_KEY` — Resend email API key (fallback for forgot-password if WhatsApp unavailable)
- `AFIP_CUIT` — Taxpayer CUIT for AFIP billing
- `AFIP_CERT` — Content of AFIP certificate file (.crt)
- `AFIP_KEY` — Content of AFIP private key file (.key)
- `AFIP_PRODUCTION` (`true` / `false`) — switches AFIP environment between homologation and production
- `MP_WEBHOOK_SECRET` — Webhook secret signature key from MercadoPago

Frontend: `environment.ts` → `http://localhost:3000`; `environment.prod.ts` → Render URL.

---

## 🎨 Organic Design System Guidelines (Frontend)

To maintain design consistency and prevent bugs (like icon distortion or broken images), all new UI components and modifications MUST adhere to these rules:

1. **Warm Palette Colors (CSS Variables)**:
   - Always reference the defined HSL/Hex variables in `styles.scss` instead of hardcoding cold Tailwind grays/blues:
     - Background: `var(--bg-app)` (Sand: `#E8DCC7`)
     - Cards/Surfaces: `var(--bg-surface)` (Warm Cream: `#FAF6F0`)
     - Primary accents: `var(--accent-terracotta)` (`#C66B3D`)
     - Secondary accents: `var(--accent-moss)` (`#606C38`), `var(--accent-sage)` (`#8B9D83`)
     - Text: `var(--text-main)` / `var(--text-earth)` (`#2B2521`)
     - Borders: `var(--border-color)` / `var(--border-organic)`

2. **Typography**:
   - Headers/Titles: Use `font-family: 'Fraunces', serif !important;` (already applied to `h1-h6`, `.p-dialog-title`, `.p-column-title`).
   - Body/Controls/Inputs: Use `font-family: 'Epilogue', sans-serif !important;`.

3. **PrimeNG & Button Overrides (Crucial)**:
   - **DO NOT** use the PrimeNG component `<p-button>` for row action icons or basic text buttons, as global pill-shape overrides will distort their paddings and make them render as solid pills.
   - **DO** use the native directive `<button pButton>` with explicit Tailwind and PrimeNG styling:
     - *Row actions (edit, delete)*: Use `.p-button-rounded .p-button-text .p-button-sm` with target text colors (e.g., `text-[var(--accent-terracotta)] hover:bg-[var(--accent-terracotta)]/10`).
     - *Primary buttons*: Use `.p-button-rounded .p-button-sm .p-button-primary`.
     - *Secondary/Cancel buttons*: Use `.p-button-rounded .p-button-text .p-button-sm text-slate-500 hover:bg-slate-100`.

4. **Dialogs & Modals**:
   - Modals use the `.p-dialog` container class. We have styled it globally to have `border-radius: 20px !important`, `overflow: hidden`, and custom organic borders/shadows.
   - All input controls inside dialog forms must have `class="w-full"` or `styleClass="w-full"` and `[style]="{'width':'100%'}"` to ensure they stretch cleanly to the width of the dialog.

5. **Icon Preservation**:
   - Since global text rules apply `Epilogue` font to standard elements with `!important`, we have locked the PrimeIcons font on the `.pi` class:
     ```css
     .pi {
         font-family: 'primeicons' !important;
     }
     ```
     Never remove this override, otherwise all PrimeIcons will render as empty boxes.

6. **Absolute Asset Paths**:
   - Always refer to application assets using absolute paths (e.g., `src="/favicon.png"`) instead of relative paths (e.g., `src="favicon.png"`). Relative paths break when navigating to nested routes like `/admin/users`.

---

## Known Bugs

### Críticos (bloquean producción)
~~- **`main.ts:5-7`** — `console.log` expone la API URL en la consola del browser en producción. Eliminados los 3 logs de arranque. ✓~~
~~- **`mercadopago.service.ts:48,72`** — `back_url` hardcodeada. Movida a `configService.get('FRONTEND_URL')` con fallback. ✓~~
~~- **`home.component.html`** — Archivo orphanado (no referenciado en routing). La ruta `/` usa el componente `Landing` real. ✓~~
~~- **`environment.prod.ts:4`** — VAPID key regenerada con `npx web-push generate-vapid-keys`. ✓~~

### Alta prioridad (visibles al usuario)
~~- **`login.html`, `register.html`, `forgot-password.html`** — Botones migrados a `<button pButton>` con `[loading]` nativo de PrimeNG. ✓~~
~~- **`app.module.ts:37-40`** — `console.log` de debug eliminados del backend. ✓~~
~~- **`login.html`** — Campo de contraseña ahora muestra mensaje de error de validación con `<small>`. ✓~~
~~- **`calendar-event.service.ts`, `deadline.service.ts`** — Toast "Error al cargar eventos/vencimientos" aparecía al abrir la app (incluso en login) porque los constructores disparaban HTTP antes de tener sesión. Corregido con guard `if (localStorage.getItem('auth_token'))` en ambos constructores. ✓~~
~~- **`index.html`** — Favicon no aparecía en la tab del navegador porque `favicon.png` pesaba 1.5 MB y medía 2048 px. Corregido: ahora usa `icons/themis.svg` como primario y `favicon-64.png` (64×64 px, 6 KB) como fallback. ✓~~

### Media prioridad
~~- **`expediente.service.ts`, `client.service.ts`, `deadline.service.ts`, `calendar-event.service.ts`** — Reemplazados `console.error` con `Swal.fire` toast en todos los handlers de error HTTP. ✓~~
~~- **`register.html`** — Agregado hint estático con requisitos de contraseña debajo del campo. ✓~~
~~- **`mercadopago.service.ts:55`** — Comentario stale eliminado. ✓~~

---

## Security Gaps

Todos los gaps de seguridad conocidos han sido corregidos en el código. Ver sección **"Pendientes de Acción Manual"** al final de este archivo para las variables de entorno que aún faltan configurar en Render.

---

## Module Completeness

| Área                | Estado  | Próximo paso                                                              |
| ------------------- | ------- | ------------------------------------------------------------------------- |
| Auth (BE+FE)        | 100%    | —                                                                         |
| Clientes            | 99%     | —                                                                         |
| Expedientes         | 99%     | —                                                                         |
| Calendario          | 99%     | —                                                                         |
| Profile             | 100%    | —                                                                         |
| Subscription UI     | 99%     | —                                                                         |
| Dashboard           | 99%     | —                                                                         |
| Admin/Users         | 99%     | —                                                                         |
| Documents UI        | 99%     | —                                                                         |
| Copilot             | 100%    | Módulo de IA premium con análisis general, redacción de escritos, resúmenes de causas, análisis de riesgo y calculadora interactiva predictiva de costos judiciales con exportación PDF/Word. |
| Calendar (BE)       | 100%    | VAPID keys generadas. Ver sección "Pendientes de configurar en Render". |
| Facturas y Audits   | 99%     | —                                                                         |

---

## Regla de mantenimiento.

**Actualizar este archivo después de cada fix.** Cuando se resuelve un bug o se completa una mejora:

- Borrar o tachar el ítem de Known Bugs / Security Gaps
- Actualizar el porcentaje y próximo paso en Module Completeness
- Nunca dejar referencias a problemas ya resueltos sin aclarar su estado

---

## Patterns & Gotchas

- **Signals vs RxJS**: Usar `signal()` y `computed()` para nuevo estado en el frontend. Suscribirse a Observables HTTP con `.subscribe()` está bien, pero no crear `BehaviorSubject` nuevos — convertir a signal en el `tap`/`next`.
- **Audit logging**: Los módulos clients/expedientes/movimientos usan `void this.auditLogsService.log(...).catch(err => console.error('Audit log failed:', err))`. Fallos de DB no se propagan al usuario. Al agregar nuevos calls de audit log, usar el mismo patrón fire-and-forget con `.catch()`.
- **SeedService**: Creates `admin@themis.com` automatically on startup if it does not exist. Password from env `ADMIN_PASSWORD`.
- **Storage efímero en Render**: Cloudinary handles document uploads. WhatsApp auth session is now persisted in PostgreSQL via a custom `WhatsappDbStore` with `RemoteAuth` under key `RemoteAuth-themis-session`, solving the Render ephemeral restarts issue. Puppeteer cache generation is disabled (`--disk-cache-size=1`, etc.) to keep the session ZIP tiny (~1.5MB), avoiding Render event loop freezes and 504 Gateway Timeouts during LEVEL-9 RemoteAuth zipping.
- **WhatsApp Linking Logic**: The frontend polling requires both `status.ready` and `status.number` to be present before stopping the poll, ensuring `WHATSAPP_NUMBER` is correctly written to system settings.
- **synchronize:true en prod**: TypeORM crea/altera tablas al iniciar. Cambios de columna pueden perder datos. No usar para eliminar columnas — hacerlo manualmente en la DB.
- **Hardcoded values a recordar**:
  - MercadoPago: monto `15000 ARS` en `mercadopago.service.ts`
  - Expedientes: límite de 30 en plan básico hardcodeado en el template frontend
  - Grace period: `GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000` definido una sola vez en `SubscriptionService` (`core/services/subscription.service.ts`). No duplicar.
  - CORS: origins hardcodeados en `backend/src/main.ts`
- **Tests**: Jest unit test suite has been added for clients pagination, AI activation/fallback logic, and database OTP persistence. Run `npx jest --verbose` in `backend` folder to execute (all 10 tests passing).
- **whatsapp-auth/ in .gitignore**: `backend/whatsapp-auth/` is ignored by `.gitignore` in the repository root to prevent committing chromium session cache.
- **OTP con crypto.randomInt**: Los OTPs usan `import { randomInt } from 'crypto'` (no `Math.random()`). Límite de 5 intentos fallidos antes de invalidar — y están guardados en la tabla `otps` de PostgreSQL.
- **Documents service usa userId**: `findAll`, `findOne`, `remove`, `create` reciben `userId` para ownership. El controller extrae `req.user.userId` del JWT.
- **Kanban: detectar columna por referencia**: `this.columns.find(c => c.items === event.container.data)` es más robusto que `event.container.id` (CDK puede devolver ID interno).
- **chart.js instalado**: `legal-tech-app` tiene `chart.js ^4.5.1` + `ChartModule` de PrimeNG para el dashboard.
- **Auth endpoints públicos**: `/auth/forgot-password` y `/auth/reset-password` no requieren JWT. OTPs keyed por `forgot_<email>` para no colisionar con los del perfil.
- **Servicios root inyectados en AppComponent**: `CalendarEventService` y `DeadlineService` son `providedIn: 'root'` e inyectados (directamente o vía `NotificationService`) en `AppComponent`, lo que los instancia antes de autenticación. Sus constructores deben guardar el arranque HTTP con `if (localStorage.getItem('auth_token'))`. `ClientService` y `ExpedienteService` tienen el mismo patrón de constructor pero solo se instancian en rutas lazy, por lo que no requieren el guard.
- **Landing logo**: El logo del navbar/footer usa el SVG de `public/icons/themis.svg` inlineado con `fill="currentColor"`. El color se controla con la variable CSS `--logo-icon-color` definida en `landing.scss` (light: `#160E0A`, dark: `#C9B08A`). El texto "Themis" usa la fuente `Caesar Dressing` (clase `.font-caesar`).
- **Favicon**: `public/favicon.png` original (1.5 MB, 2048 px) no era renderizado por los navegadores. `index.html` ahora apunta a `icons/themis.svg` (primario, SVG, soportado por Chrome/Firefox/Edge modernos) y `favicon-64.png` (64×64, 6 KB) como fallback.
- **Local DB dev setup**: PostgreSQL en `localhost:5432`, user `postgres`, password `1234`, database `legal_tech_db`. Cuentas de test sembradas (contraseña `password123`): `multifranco0@gmail.com` (2 clientes, 2 expedientes), `admin@estudio.com` (1 cliente, 2 expedientes).

---

## Recommended Next Steps & Innovative Ideas

### Next Steps:
1. **Configure API Keys in Production**: Add `GEMINI_API_KEY` on Render to fully run the integrated AI copilot and PDF parsing features for free, or add `OPENAI_API_KEY` if preferred.
2. **AFIP Point of Sale Configuration**: Allow configuring custom points of sale from the user profile settings.
3. **Lazy-Loaded Account Movements**: Implement server-side pagination for movement lists (cuenta corriente).

### Innovative Feature Ideas:
1. **Two-Way Client WhatsApp Bot**: Clients query their case files by text message (e.g., `"status"`) and the bot responds with case details.
2. **Judicial Interest Calculator**: Integrates provincial/national interest tables to calculate updates and output PDFs.
3. **Análisis Predictivo de Costos del Juicio**: Completado. Ahora incluye calculadora interactiva con desgloses por provincia/Nación y reporte de viabilidad generado por IA.

---

## Pendientes de Acción Manual (fuera del repositorio)

Todo lo que figura aquí requiere acción directa sobre Render o servicios externos. No hay cambios de código pendientes.

### A) Variables de entorno — configurar en Render (Environment → Add Variable)

- `MP_WEBHOOK_SECRET` — mercadopago.com.ar → Tu negocio → Configuración → Notificaciones → Webhooks → Clave secreta, apuntando a `https://themis.up.railway.app/mercadopago/webhook`. Sin esta variable el webhook acepta todas las requests sin verificar firma (loguea warning pero no rompe).
- `RESEND_API_KEY` — resend.com → API Keys. Sin esta variable el fallback a email en forgot-password no funciona (WhatsApp sigue andando normalmente).
- `GEMINI_API_KEY` — Google AI Studio. Sin esta variable el Copilot IA y el análisis de PDFs no funcionan en producción.
- `FRONTEND_URL` — `https://legal-tech-app-woad.vercel.app`. Necesario para que el `back_url` de MercadoPago apunte correctamente en producción.
- `VAPID_PUBLIC_KEY` — generada con `npx web-push generate-vapid-keys`. Sin esta variable el backend genera claves efímeras en cada restart, invalidando todas las suscripciones push existentes.
- `VAPID_PRIVATE_KEY` — clave privada correspondiente. Guardar también en `.env` local.

### B) Migración SQL de la entidad Subscription (una sola vez, después del próximo deploy)

Los campos `subscriptionStatus`, `subscriptionExpiresAt` y `mpSubscriptionId` fueron extraídos de la tabla `user` a una tabla `subscription` separada (`Subscription` entity en `backend/src/users/entities/subscription.entity.ts`). El código ya está actualizado y compila. La migración de datos debe ejecutarse manualmente en Render porque TypeORM `synchronize:true` crea tablas pero nunca mueve datos.

**Secuencia de deploy:**

1. **Push a `main`** y esperar que Render termine el deploy. TypeORM creará la tabla `subscription` automáticamente (con la columna `userId` FK + UNIQUE a `user.id`).

2. **Ejecutar en Render → PostgreSQL → psql:**

```sql
-- Copiar datos de suscripción de la tabla user a subscription
INSERT INTO "subscription" (
  "userId", "subscriptionStatus", "subscriptionExpiresAt", "mpSubscriptionId", "createdAt", "updatedAt"
)
SELECT
  id,
  COALESCE("subscriptionStatus", 'trial'),
  "subscriptionExpiresAt",
  "mpSubscriptionId",
  NOW(), NOW()
FROM "user"
ON CONFLICT ("userId") DO NOTHING;

-- Verificar: ambos counts deben coincidir
SELECT COUNT(*) AS total_users FROM "user";
SELECT COUNT(*) AS total_subscriptions FROM "subscription";
```

3. **Verificar** que el login y el dashboard cargan sin errores 403/500. Revisar logs de Render buscando errores de TypeORM.

4. **Cuando todo esté estable** (opcional): eliminar las columnas viejas de la tabla `user`:

```sql
ALTER TABLE "user" DROP COLUMN IF EXISTS "subscriptionStatus";
ALTER TABLE "user" DROP COLUMN IF EXISTS "subscriptionExpiresAt";
ALTER TABLE "user" DROP COLUMN IF EXISTS "mpSubscriptionId";
```
