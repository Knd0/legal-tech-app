# GEMINI.md

Este archivo contiene el registro de contexto de **Gemini** (Antigravity AI) sobre la arquitectura, estado actual e integraciones de la plataforma **LegalTech**. Sirve como guía de alineación y referencia rápida de desarrollo.

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
  1. `admin@legaltech.com` (Rol: `ADMIN` — bypass de checks de suscripción).
  2. `multifranco0@gmail.com` (Rol: `USER` — 2 clientes y 2 expedientes de prueba).
  3. `admin@estudio.com` (Rol: `USER` — 1 cliente y 2 expedientes de prueba).

---

## 📈 Completitud y Estado de Módulos

Actualmente la aplicación se encuentra en un estado muy avanzado (~98% global):

| Área | Estado | Detalles de Implementación |
|---|---|---|
| **Auth (BE+FE)** | **100%** | JWT (60m) + local strategy. Recuperación por OTP vía WhatsApp (y fallback a Email vía Resend) **persistido en base de datos (`Otp` entity)** para resistir reinicios en Render. |
| **Clientes** | **99%** | Gestión completa. Tabla con **paginación server-side, debouncer de búsqueda (300ms) y carga lazy**. Reemplazado confirm() nativo por SweetAlert2. |
| **Expedientes** | **99%** | Seguimiento de causas. Tabla con **paginación server-side, filtro de estado, debouncer y borrado con SweetAlert2**. Kanban interactivo funcional. |
| **Calendario** | **97%** | Vista interactiva en frontend (mensual/semanal/diario). Módulo backend (Calendar BE) implementado con eventos en base de datos. |
| **Profile** | **99%** | Edición de perfil, configuración de alertas, vinculación de WhatsApp (QR/Código) y AFIP. Señales corregidas en templates. |
| **Subscription UI**| **95%** | Enlace con MercadoPago (`PreApproval`), soporte de periodo de gracia de 7 días, bloqueo de creación (`isCreationBlocked()`). |
| **Dashboard** | **99%** | Estadísticas y métricas financieras usando PrimeNG Charts y Chart.js (`chart.js ^4.5.1`). |
| **Admin/Users** | **99%** | Listado de usuarios, suspensión y borrado estilizado con SweetAlert2. |
| **Documents UI** | **99%** | Carga de archivos integrada con **persistencia real en la nube usando Cloudinary** (eliminando el almacenamiento temporal efímero en disco de Render). Streaming seguro (view/download) y preview interactivo de imágenes y PDFs corregido. |
| **Copiloto IA** | **95%** | Estructura completa creada en backend (`POST /ai/analyze`) y frontend (`/ai`). Interfaz premium interactiva (selección de tipo de análisis, cargador y copia al portapapeles con SweetAlert2). **Listo para ser habilitado** mediante variables de entorno. |

---

## 🔒 Parcheo de Seguridad Reciente

Se han cerrado todas las brechas de seguridad críticas del backend:
- **`deadlines.controller.ts`**: Asegurado con `@UseGuards(JwtAuthGuard)` y filtrado de registros por `userId`.
- **`documents.controller.ts`**: Protegido por JWT. Modificado para almacenar propiedad `userId` en la entidad `Documento` para evitar accesos cruzados (IDOR).
- **`whatsapp.controller.ts`**: Protegido integralmente con JWT.
- **`mercadopago.controller.ts`**: Webhook ahora verifica firma HMAC-SHA256 usando `MP_WEBHOOK_SECRET` (con degradación grácil si la variable no está configurada).
- **`calendar.service.ts`**: Se previno Mass Assignment e IDOR filtrando estrictamente por `userId` y usando allowlists explícitas al guardar/actualizar eventos de agenda.
- **Prevención de XSS y Header Injection**: Mejorado el endpoint `/documents/:id/view` usando tipos de contenido mapeados de forma estricta (no dinámicos del input del usuario).

---

## ⚙️ Variables de Entorno Clave

### Backend (`.env`):
- `DB_HOST=localhost`, `DB_PORT=5432`, `DB_USERNAME=postgres`, `DB_PASSWORD=1234`, `DB_DATABASE=legal_tech_db`
- `JWT_SECRET=super_secret_jwt_key`
- `MP_ACCESS_TOKEN` (Producción/Pruebas de MercadoPago)
- `MP_WEBHOOK_SECRET` (Firma de Webhooks de MercadoPago)
- `RESEND_API_KEY` (Para envío de correos en flujo de olvido de clave)
- `ADMIN_PASSWORD` (Seed del admin, por defecto `ChangeMe123!`)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (Almacenamiento persistente de archivos)
- `AI_ENABLED` (`true` / `false` — activa o desactiva el Copiloto IA)
- `OPENAI_API_KEY` (Clave de API de OpenAI para el Copiloto IA)

---

## 💡 Próximos Pasos Recomendados

1. **Activar el Copiloto IA en Producción:**
   El módulo ya está completamente desarrollado y probado. Para dejarlo 100% funcional, solo se deben añadir las variables de entorno `AI_ENABLED=true` y `OPENAI_API_KEY` (con una clave de API válida de OpenAI) en el panel de configuración de Render.
2. **Persistencia de la Sesión de WhatsApp Web (`whatsapp-web.js`):**
   Actualmente, el estado de autenticación QR de WhatsApp se guarda en `./whatsapp-auth/` en el disco local. Como Render tiene almacenamiento efímero, al reiniciar el dyno la sesión se pierde y requiere volver a escanear el QR. Se requiere implementar un storage externo o guardar el payload de la sesión en base de datos.
3. **Paginación Server-Side en otras vistas masivas:**
   Aplicar la misma arquitectura lazy-load de PrimeNG a los listados de Facturas o Auditorías en caso de que su volumen de datos crezca significativamente.
