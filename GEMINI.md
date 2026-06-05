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

Actualmente la aplicación se encuentra en un estado muy avanzado (~95% global):

| Área | Estado | Detalles de Implementación |
|---|---|---|
| **Auth (BE+FE)** | **99%** | JWT (60m) + local strategy. Recuperación por OTP vía WhatsApp (in-memory) y fallback a Email (vía Resend). |
| **Clientes** | **95%** | Gestión completa. Tabla corregida con campo `fechaAlta` desde el backend. Reemplazado confirm() nativo por SweetAlert2. |
| **Expedientes** | **97%** | Seguimiento de causas. Kanban interactivo funcional (detecta columnas por referencia a items para evitar fallos del CDK). |
| **Calendario** | **97%** | Vista interactiva en frontend (mensual/semanal/diario). Módulo backend (Calendar BE) implementado con eventos en base de datos. |
| **Profile** | **99%** | Edición de perfil, configuración de alertas, vinculación de WhatsApp (QR/Código) y AFIP. Señales corregidas en templates. |
| **Subscription UI**| **95%** | Enlace con MercadoPago (`PreApproval`), soporte de periodo de gracia de 7 días, bloqueo de creación (`isCreationBlocked()`). |
| **Dashboard** | **99%** | Estadísticas y métricas financieras usando PrimeNG Charts y Chart.js (`chart.js ^4.5.1`). |
| **Admin/Users** | **99%** | Listado de usuarios, suspensión y borrado estilizado con SweetAlert2. |
| **Documents UI** | **92%** | Carga de archivos locales (Multer). Se añadió **preview interactivo** de documentos (PDFs e imágenes). *Almacenamiento efímero en Render (necesita migrar a S3/Supabase Storage en producción).* |

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

---

## 💡 Próximos Pasos Recomendados

1. **Soporte de Persistencia Real de Documentos (S3 / Cloudinary / Supabase):**
   Actualmente Render borra los archivos en `./uploads/` con cada redeploy. Se requiere implementar un storage cloud.
2. **Paginación Server-Side:**
   Tanto en Clientes como en Expedientes las búsquedas se cargan por completo en memoria. Añadir paginación NestJS -> Angular mejoraría la performance en bases de datos grandes.
3. **Módulo de Inteligencia Artificial (OpenAI SDK):**
   El backend tiene instalado `openai`, y existe un stub en el frontend `/ai/analyze` listo para ser desarrollado. Podríamos implementar un asistente legal para resumir expedientes o redactar escritos.
4. **Persistencia del Estado OTP de WhatsApp:**
   El OTP para restablecimiento de contraseña se guarda en memoria del servidor. Si el servidor de NestJS se reinicia en Render (lo cual ocurre diariamente en planes gratuitos), los OTPs en curso se pierden. Guardarlos temporalmente en base de datos resolvería este issue.
