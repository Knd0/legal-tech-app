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
- **PostgreSQL Producción:** Hospedado en Railway (inyectado automáticamente vía la variable de entorno `DATABASE_URL`).
- **Cuentas Sembradas (`SeedService` & script manual con contraseña `password123`):**
  1. `admin@themis.com` (Rol: `ADMIN` — bypass de checks de suscripción).
  2. `multifranco0@gmail.com` (Rol: `USER` — 2 clientes y 2 expedientes de prueba).
  3. `admin@estudio.com` (Rol: `USER` — 1 cliente y 2 expedientes de prueba).

---

## 📈 Completitud y Estado de Módulos

Actualmente la aplicación se encuentra en un estado muy avanzado (~99% global):

| Area | Estado | Detalles de Implementation |
|---|---|---|
| **Auth (BE+FE)** | **100%** | JWT (60m) + local strategy. Recuperación por OTP vía WhatsApp (y fallback a Email vía Resend) **persistido en base de datos (`Otp` entity)** para resistir reinicios en Railway. |
| **Clientes** | **99%** | Gestión completa. Tabla con **paginación server-side, debouncer de búsqueda (300ms) y carga lazy**. Reemplazado confirm() nativo por SweetAlert2. |
| **Expedientes** | **99%** | Seguimiento de causas. Tabla con **paginación server-side, filtro de estado, debouncer y borrado con SweetAlert2**. Kanban interactivo funcional. |
| **Calendario** | **99%** | Vista interactiva en frontend (mensual/semanal/diario). Módulo backend (Calendar BE) implementado con eventos en base de datos. Integrado sistema de alertas pop-up nativas (PC/Celular) y en la misma app (SweetAlert2) para eventos y vencimientos de hoy/próximos. |
| **Profile** | **100%** | Edición de perfil, configuración de alertas, vinculación de WhatsApp (QR/Código) y AFIP. **Persistencia de sesión de WhatsApp Web en PostgreSQL (`whatsapp_sessions`) usando RemoteAuth.** |
| **Subscription UI**| **100%** | Verificación real del pago en success page: llama a `GET /mercadopago/subscription`, actualiza el signal de auth, muestra estados success/pending/failure con botón de reintento. **Agregada simulación completa de pago en local/desarrollo** con bypass de MercadoPago en controller/service y widget disparador en grilla. |
| **Dashboard** | **99%** | Estadísticas y métricas financieras usando PrimeNG Charts y Chart.js (`chart.js ^4.5.1`). |
| **Admin/Users** | **100%** | Panel Super Admin y formularios rediseñados bajo estética Organic. Corregido bug de actualización de datos (PATCH 500) y aplanamiento de campos de suscripción. |
| **Documents UI** | **99%** | Carga de archivos integrada con **persistencia real en la nube usando Cloudinary**. Streaming seguro (view/download) y preview interactivo de imágenes y PDFs. |
| **Copilot** | **100%** | Módulo de IA premium: análisis de textos, redactor de escritos judiciales, resúmenes procesales, análisis de riesgo/probabilidad de éxito, y calculadora interactiva de costos y análisis predictivo de viabilidad con reportes en PDF/Word. Gemini 2.5 Flash por defecto, fallback a OpenAI. |
| **Facturas y Auditorías**| **100%** | Paginación server-side en facturas y audit logs. **Implementado soporte dinámico para múltiples Puntos de Venta en AFIP** (configurados en el perfil de cada usuario, por defecto 1). |
| **Landing Page** | **100%** | Rediseño bajo el ancla estética **Organic** (diseño cálido y natural, Oat/Sand surfaces, Terracotta/Moss accents, tipografías Fraunces/Epilogue, y canvas animado de partículas interactivo de alta visibilidad). |

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
~~- **`calendar-event.service.ts`, `deadline.service.ts`** — Toast "Error al cargar eventos/vencimientos" aparecía al abrir la app (incluso en login). Los constructores disparaban HTTP sin sesión activa vía `AppComponent → NotificationService`. Corregido con `if (localStorage.getItem('auth_token'))` en ambos constructores. ✓~~
~~- **`index.html`** — Favicon no aparecía en la tab del navegador: `favicon.png` original pesaba 1.5 MB / 2048 px. Ahora usa `icons/themis.svg` (primario) y `favicon-64.png` (64×64 px, 6 KB) como fallback. ✓~~

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
- `MP_WEBHOOK_SECRET` (Firma de Webhooks de MercadoPago — **pendiente en Railway**)
- `RESEND_API_KEY` (Para envío de correos en flujo de olvido de clave — **pendiente en Railway**; sin esta variable el fallback a email no funciona, WhatsApp sigue andando normalmente)
- `FRONTEND_URL` (URL del frontend — ya se usa en el código; configurar en Railway para que `back_url` de MercadoPago apunte correctamente)
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
- **Audit logging**: Los módulos clients/expedientes/movimientos usan `void this.auditLogsService.log(...).catch(err => console.error('Audit log failed:', err))`. Fallos de DB no se propagan al usuario. Al agregar nuevos calls de audit log, usar el mismo patrón fire-and-forget con `.catch()`.
- **SeedService**: Crea `admin@themis.com` automáticamente al iniciar si no existe. Contraseña desde env `ADMIN_PASSWORD`.
- **synchronize:true en prod**: TypeORM crea/altera tablas al iniciar. Cambios de columna pueden perder datos. No usar para eliminar columnas — hacerlo manualmente en la DB.
- **Hardcoded values a recordar**:
  - MercadoPago: monto `15000 ARS` en `mercadopago.service.ts`
  - Expedientes: límite de 30 en plan básico hardcodeado en el template frontend
  - Grace period: `GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000` definido una sola vez en `SubscriptionService` (`core/services/subscription.service.ts`). No duplicar.
  - CORS: origins hardcodeados en `backend/src/main.ts`
- **Tests**: Suite Jest agregada para paginación de clientes, activación/fallback de IA y persistencia de OTPs en DB. Ejecutar `npx jest --verbose` en carpeta `backend` (todos los 10 tests pasan).
- **OTP con crypto.randomInt**: Los OTPs usan `import { randomInt } from 'crypto'` (no `Math.random()`). Límite de 5 intentos fallidos antes de invalidar — guardados en tabla `otps` de PostgreSQL.
- **Kanban: detectar columna por referencia**: `this.columns.find(c => c.items === event.container.data)` es más robusto que `event.container.id` (CDK puede devolver ID interno).
- **Auth endpoints públicos**: `/auth/forgot-password` y `/auth/reset-password` no requieren JWT. OTPs keyed por `forgot_<email>` para no colisionar con los del perfil.
- **whatsapp-auth/ en .gitignore**: `backend/whatsapp-auth/` ignorado por `.gitignore` para no commitear el caché de sesión de Chromium.
- **Servicios root + AppComponent**: `CalendarEventService` y `DeadlineService` se instancian al arrancar la app (antes de auth). Sus constructores usan `if (localStorage.getItem('auth_token'))` para no disparar HTTP sin sesión. `ClientService` / `ExpedienteService` tienen el mismo patrón pero solo viven en rutas lazy — no necesitan el guard.
- **Landing logo y favicon**: El logo navbar/footer es el SVG `public/icons/themis.svg` inlineado con `fill="currentColor"`, coloreado por `--logo-icon-color` en `landing.scss`. Fuente del texto "Themis": `Caesar Dressing` (clase `.font-caesar`). El favicon ahora usa `icons/themis.svg` + `favicon-64.png` (64×64 px).
- **Estado de Bot de WhatsApp en Perfil**: La interfaz de configuración de alertas de WhatsApp (`ProfileComponent`) utiliza el signal `whatsappBotReady` y sondeos dinámicos (`startQrPolling`) para reflejar el estado del bot en tiempo real. Para evitar estados inconsistentes (como mostrar "Bot Conectado" cuando la sesión en el backend se ha cerrado), la UI valida que el bot esté listo en el servidor (`status.ready`). Si se detecta desconexión, la UI expone el contenedor de vinculación (código QR o código de emparejamiento por teléfono). El sondeo se inicia inmediatamente al activar el interruptor de WhatsApp. Además, se desactivó todo almacenamiento caché en el Chromium de Puppeteer (mediante flags como `--disk-cache-size=1`) para reducir el tamaño del ZIP de sesión a un mínimo (~1MB), evitando congelamientos (504 Gateway Timeout) en entornos con recursos limitados (Railway), y se obliga a que el frontend reciba el número telefónico del bot (`status.number`) antes de dar por completado el emparejamiento.
- **Inicialización de WhatsApp no Bloqueante**: La inicialización automática del bot de WhatsApp en `onApplicationBootstrap()` se ejecuta de forma asíncrona en segundo plano (sin `await`). Esto previene que el arranque de la API en NestJS se bloquee al iniciar Puppeteer/Chromium, resolviendo de manera definitiva los errores `504 Gateway Timeout` en plataformas de hosting (Railway). Adicionalmente, el bot se desactiva por completo en scripts CLI, semilla (`seed:prod`) y suites de prueba Jest para economizar memoria RAM.
- **Gestión de Notificaciones de WhatsApp por Rol**: La vinculación por código QR/teléfono de la sesión central de WhatsApp Web está disponible exclusivamente para usuarios `ADMIN`. Los endpoints de actualización global de `/settings` están protegidos con `@Roles('ADMIN')`. Los abogados (`USER`) ven una interfaz simplificada que les permite activar o desactivar alertas de WhatsApp en sus propios números de teléfono verificados, con soporte de repeticiones (1, 2, 3 o 4 veces al día distribuidas uniformemente a lo largo de las 24 horas usando un cron por hora) y hora de inicio personalizada. El bot central de la plataforma les envía los recordatorios de vencimiento directamente a su número verificado.
- **Gestión de Inicialización y Bloqueo de WhatsApp**: Se eliminó la inicialización automática del bot en el método `getStatus()` para erradicar los bucles infinitos de lanzamientos de Puppeteer causados por el sondeo periódico del frontend. Ahora la inicialización ocurre a demanda (clic en "Vincular WhatsApp") o en el arranque si hay una sesión previa. Además, se implementó `initializingPromise` para evitar lanzamientos paralelos de Puppeteer, y se incorporó una limpieza proactiva de `lockfile` en Windows antes del inicio, resolviendo el error falso de "browser already running". Adicionalmente, se implementó `restartingPromise` como semáforo del comando `restart()` y se modificaron `restart()`, `ensureInitialized()` y `logout()` para esperar y sincronizar sus llamadas promisorias de forma atómica, evitando carreras concurrentes de inicialización/destrucción de Puppeteer. Para solucionar definitivamente el error de redirección de navegador no compatible y bloqueo de IndexedDB por sandbox en Windows, implementamos un resolvedor dinámico de rutas del navegador (Chrome/Edge local) y establecemos el `dataPath` de la sesión fuera de cualquier carpeta oculta o con punto (como `.gemini`), apuntando en Windows a `C:\Users\franc\themis-whatsapp-auth` (mientras que en Linux de producción mantiene el valor `./whatsapp-auth` absoluto), resolviendo los cuelgues `Protocol error (Runtime.callFunctionOn): Execution context was destroyed`. Se configuraron además exclusiones de watch (`whatsapp-auth`, `uploads`, `.wwebjs_cache`) en `tsconfig.json` para evitar bucles de reinicio infinito en desarrollo local, y se forzó la destrucción proactiva del cliente (`client.destroy()`) en el catch de inicialización para liberar de inmediato cualquier bloqueo de archivos ante un fallo. Para resolver de forma definitiva las fallas en re-intentos sucesivos tras fallar el arranque, se abstrayó la instanciación en `createClient()` y se implementó `recreateClient()`, recreando el objeto `Client` en frío desde cero antes de cada inicialización y evitando la reutilización de instancias destruidas. También se habilitó la propagación de excepciones y verificación rigurosa de errores en `waitForInitialization()` para reportar fallas reales al frontend y evitar llamados a utilidades de emparejamiento sobre clientes inactivos. *Bypass de Bug de Código de Emparejamiento:* Para solucionar la falla `window.onCodeReceivedEvent is not a function` al pedir el código de emparejamiento, inyectamos y exponemos de manera dinámica `window.onCodeReceivedEvent` en el contexto de Puppeteer justo antes de delegar la llamada a la función nativa del cliente.



---

## 🔧 Regla de Mantenimiento

**Actualizar este archivo después de cada fix.** Cuando se resuelve un bug o se completa una mejora:

- Borrar o tachar el ítem de Known Bugs / Security Gaps
- Actualizar el porcentaje y próximo paso en Module Completeness
- Nunca dejar referencias a problemas ya resueltos sin aclarar su estado

---

## 💡 Próximos Pasos Recomendados

1. **Configurar la API Key del Copilot en Producción (Railway):**
   El módulo está 100% desarrollado. Para activarlo de forma gratuita en producción, obtenga una API key en Google AI Studio (https://aistudio.google.com/) y configúrela como variable de entorno `GEMINI_API_KEY` en Railway.
2. **Paginación Server-Side en listados de Movimientos (Cuenta Corriente):**
   Si la cantidad de transacciones por cliente se incrementa fuertemente, se puede aplicar paginación diferida en la lista principal de movimientos del cliente.
3. **Habilitar Bot de WhatsApp Bidireccional Interactivo (Opcional)**:
   El flujo para recibir mensajes de clientes y auto-responderles consultas de expedientes, vencimientos y saldos está 100% programado e integrado en `handleIncomingMessage()` de `whatsapp.service.ts`. A petición del usuario, **el listener de mensajes entrantes (`client.on('message')`) se encuentra inhabilitado/comentado temporalmente** hasta que se decida su activación. Actualmente, el bot opera únicamente de forma unidireccional (envío de alertas automáticas).

---

## 🚀 Ideas Innovadoras para el Futuro

1. **Bot de WhatsApp Bidireccional (Interactivo para Clientes):**
   Habilitar que los clientes del estudio jurídico puedan enviarle un mensaje al bot de WhatsApp (ej. `"estado"`) y el bot responda de forma automática con el estado actual del expediente y los últimos movimientos públicos permitidos.
2. **Cálculo Automático de Actualizaciones Judiciales (Calculadora de Intereses Compleja):**
   Integrar una calculadora financiera avanzada con tasas de interés oficiales de distintos fueros y provincias (ej. Tasa Activa del Banco Nación, Tasa Pasiva de Buenos Aires, etc.) para liquidar intereses de forma interactiva y exportar el reporte en PDF.
3. **Análisis Predictivo de Costos del Juicio:**
   Estimar de forma interactiva la tasa de justicia, bonos, honorarios mínimos de ley y gastos administrativos estimados antes de iniciar la demanda para cotizar mejor a los clientes.

## 🎨 Pautas de Diseño del Sistema Visual "Organic" (Frontend)

Para mantener la consistencia estética y evitar regresiones visuales (como distorsión de iconos o imágenes rotas), cualquier desarrollo nuevo en la interfaz debe seguir estas reglas:

1. **Paleta de Colores Cálida (Variables CSS)**:
   - Evitar usar colores fríos (grises/azules estándar de Tailwind). En su lugar usar siempre las variables de `:root` de `styles.scss`:
     - Fondo General: `var(--bg-app)` (Arena: `#E8DCC7`)
     - Tarjetas y Superficies: `var(--bg-surface)` (Crema Cálido/Avena suave: `#FAF6F0`)
     - Acentos Principales: `var(--accent-terracotta)` (`#C66B3D`)
     - Acentos Secundarios: `var(--accent-moss)` (`#606C38`) y `var(--accent-sage)` (`#8B9D83`)
     - Texto Principal: `var(--text-main)` / `var(--text-earth)` (`#2B2521`)
     - Bordes: `var(--border-color)`

2. **Tipografías**:
   - Encabezados y Títulos: Fuente **Fraunces** con peso destacado (`font-family: 'Fraunces', serif !important;` - ya está aplicada a los elementos `h1-h6`, `.p-dialog-title`, `.p-column-title`).
   - Textos de Cuerpo, Inputs y Botones: Fuente **Epilogue** (`font-family: 'Epilogue', sans-serif !important;`).

3. **Uso de Botones de PrimeNG (Crítico)**:
   - **NO UTILIZAR** el componente `<p-button>` para iconos de acción individuales en tablas o botones de texto simples, ya que la estilización global de botones en forma de píldora sólida desborda y deforma su padding.
   - **UTILIZAR SIEMPRE** el elemento nativo `<button pButton>` con clases explícitas:
     - *Botones de acción de grilla (editar, borrar, suspender)*: Utilizar clases `.p-button-rounded .p-button-text .p-button-sm` con el color de texto correspondiente (ej. `text-[var(--accent-terracotta)] hover:bg-[var(--accent-terracotta)]/10`).
     - *Botones principales*: Utilizar `.p-button-rounded .p-button-sm .p-button-primary`.
     - *Botones secundarios/Cancelar*: Utilizar `.p-button-rounded .p-button-text .p-button-sm text-slate-500 hover:bg-slate-100`.

4. **Diálogos y Modales**:
   - Los diálogos modales de la app usan el contenedor `.p-dialog`. Se ha modificado globalmente para aplicar un `border-radius: 20px !important`, `overflow: hidden`, bordes delgados y sombreados premium de estilo Organic.
   - Todos los inputs y componentes `<p-select>` dentro de los formularios en diálogos deben tener la clase `w-full` o la directiva `styleClass="w-full"` y `[style]="{'width':'100%'}"` para que se ajusten al ancho del modal y no se vean recortados.

5. **Conservación de Iconos (PrimeIcons)**:
   - Debido a que las directivas globales aplican la fuente `Epilogue` con prioridad `!important` a tags estándar como `span` y `button`, hemos fijado de forma exclusiva la fuente en la clase `.pi`:
     ```css
     .pi {
         font-family: 'primeicons' !important;
     }
     ```
     Nunca remover este override de `styles.scss`, de lo contrario todos los iconos se mostrarán como rectángulos vacíos en el navegador.

6. **Rutas de Archivos Estáticos Absolutas**:
   - Al referenciar el logo o cualquier archivo estático, usar siempre rutas absolutas (ej: `src="/favicon.png"`) en lugar de relativas (`src="favicon.png"`). Las rutas relativas devuelven error 404 al navegar en rutas anidadas como `/admin/users`.
   - **Logotipo de la marca (Balanza)**: Para la landing page pública y secciones estéticas clave se utiliza el logotipo de balanza SVG en línea premium, estilizado dinámicamente con `style="color: var(--accent-terracotta)"`.

---

## ⚠️ Pendientes de Acción Manual (fuera del repositorio)

Todo lo que figura aquí requiere acción directa sobre Railway o servicios externos. No hay cambios de código pendientes.

### A) Variables de entorno — configurar en Railway (Environment → Add Variable)

- `MP_WEBHOOK_SECRET` — mercadopago.com.ar → Tu negocio → Configuración → Notificaciones → Webhooks → Clave secreta, apuntando a `https://themis.up.railway.app/mercadopago/webhook`. Sin esta variable el webhook acepta todas las requests sin verificar firma.
- `RESEND_API_KEY` — resend.com → API Keys. Sin esta variable el fallback a email en forgot-password no funciona (WhatsApp sigue andando normalmente).
- `GEMINI_API_KEY` — Google AI Studio. Sin esta variable el Copilot IA y el análisis de PDFs no funcionan en producción.
- `FRONTEND_URL` — `https://legal-tech-app-woad.vercel.app`. Necesario para que el `back_url` de MercadoPago apunte correctamente en producción.
- `VAPID_PUBLIC_KEY` — generada con `npx web-push generate-vapid-keys`. Sin esta variable el backend genera claves efímeras en cada restart, invalidando todas las suscripciones push.
- `VAPID_PRIVATE_KEY` — clave privada correspondiente. Guardar también en `.env` local.

### B) Migración SQL de la entidad Subscription (una sola vez, después del próximo deploy)

Los campos `subscriptionStatus`, `subscriptionExpiresAt` y `mpSubscriptionId` fueron extraídos de la tabla `user` a una tabla `subscription` separada. El código ya está actualizado. La migración de datos debe ejecutarse manualmente porque TypeORM `synchronize:true` crea tablas pero nunca mueve datos.

**Secuencia de deploy:**

1. **Push a `main`** → Railway bootea → TypeORM crea la tabla `subscription` automáticamente.

2. **Ejecutar en Railway → PostgreSQL → psql:**

```sql
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

3. **Verificar** que el login y el dashboard cargan sin errores 403/500.

4. **Cuando todo esté estable** (opcional): eliminar las columnas viejas de `user`:

```sql
ALTER TABLE "user" DROP COLUMN IF EXISTS "subscriptionStatus";
ALTER TABLE "user" DROP COLUMN IF EXISTS "subscriptionExpiresAt";
ALTER TABLE "user" DROP COLUMN IF EXISTS "mpSubscriptionId";
```

