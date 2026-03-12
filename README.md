# ⚖️ LegalTech SaaS - Sistema Elite para Estudios Jurídicos

**LegalTech** es una plataforma SaaS (Software as a Service) de alto rendimiento diseñada específicamente para abogados y estudios de abogados modernos. Combina una gestión jurídica robusta con herramientas de automatización de vanguardia y un modelo de negocio escalable.

---

## 🚀 Funcionalidades Principales

### 💼 Gestión Legal Integral
*   **Gestión de Clientes y Expedientes**: Fichas digitales completas y seguimiento detallado de causas procesales.
*   **Tablero Kanban**: Visualización ágil de estados procesales para una gestión de flujo de trabajo moderna.
*   **Gestor Documental Inteligente**: Centralización de escritos, cédulas y pruebas con organización automática por expediente.
*   **Agenda Judicial**: Control total de vencimientos con alertas visuales (semáforos) y vista de calendario integral.

### 🤖 Automatización y Productividad
*   **WhatsApp Bot Integrado**: Notificaciones automáticas a clientes, recuperación de contraseñas mediante códigos OTP y envío de mensajes en un clic.
*   **Integración AFIP / ARCA**: Vinculación directa para facturación electrónica y gestión fiscal desde el perfil del abogado.
*   **Conversión de Honorarios**: Actualización automática de valores JUS y UMA para cálculos financieros precisos.

### 💎 Modelo SaaS Pro
*   **Gestión de Planes**: Diferenciación entre el *Plan Básico* (Gratuito) y el *Plan Estudio Pro* (Suscripción).
*   **Pasarela de Pagos Mercado Pago**: Procesamiento de pagos seguro y automatizado para suscripciones recurrentes.
*   **Control de Cuotas y Límites**: Restricciones de uso basadas en el plan activo (ej. límite de 30 expedientes en plan básico).
*   **Vencimiento Inteligente con Período de Gracia**: Sistema de 7 días de gracia post-vencimiento con acceso restringido (solo lectura) antes del bloqueo total.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Frontend** | Angular 19 | Arquitectura robusta, Standalone Components y Signals. |
| **Styling** | Tailwind CSS + PrimeNG | Diseño premium, responsive y altamente estético. |
| **Backend** | NestJS | API REST modular, segura y altamente escalable. |
| **Base de Datos** | PostgreSQL + TypeORM | Almacenamiento relacional sólido y consistente. |
| **Seguridad** | JWT + Passport | Autenticación blindada y gestión de roles. |
| **Integraciones** | Mercado Pago SDK | Gestión de pagos y suscripciones. |
| **Mensajería** | WhatsApp-Web.js | Automatización de comunicaciones. |

---

## 📂 Estructura del Proyecto

```text
/
├── backend/                # API REST NestJS
│   ├── src/
│   │   ├── auth/           # Gestión de Usuarios y Seguridad (JWT/OTP)
│   │   ├── mercadopago/    # Integración de pagos y Webhooks
│   │   ├── whatsapp/       # Motor del Bot y sesión persistente
│   │   ├── afip/           # Integración con servicios ARCA
│   │   └── ...             # Módulos de Clientes, Expedientes, Documentos
│   └── whatsapp-auth/      # (Ignorado) Almacenamiento de sesión WhatsApp
│
├── legal-tech-app/         # Frontend Angular Moderno
│   ├── src/app/
│   │   ├── core/           # Signals, Guards (Auth/Sub), Interceptors
│   │   ├── modules/        # Features (Landing, Dashboard, Planes, Perfil)
│   │   └── shared/         # UI Components de alto nivel
```

---

## 💻 Configuración para Desarrolladores

### Requisitos Previos
*   Node.js v18.0.0+
*   PostgreSQL 14+
*   Credenciales de prueba de Mercado Pago (Access Token).

### Despliegue Rápido
1.  **Backend**:
    ```bash
    cd backend
    npm install
    # Configurar .env basado en la documentación interna
    npm run start:dev
    ```
2.  **Frontend**:
    ```bash
    cd legal-tech-app
    npm install
    npm start
    ```

---

## 🛡️ Seguridad y Privacidad
La plataforma implementa los más altos estándares de seguridad:
*   Contraseñas cifradas con `bcrypt`.
*   Accesos protegidos por `JWT` persistente.
*   Validaciones OTP vía WhatsApp para acciones críticas.
*   Aislamiento de datos por usuario administrador de estudio.

---
**Desarrollado con excelencia por Antigravity para LegalTech Evolution**
