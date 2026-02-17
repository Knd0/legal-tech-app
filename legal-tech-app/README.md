# LegalTech App - Sistema de Gestión para Estudios Jurídicos

Bienvenido al repositorio de **LegalTech App**, una solución integral moderna diseñada para abogados y estudios jurídicos. Esta aplicación combina una gestión eficiente de clientes y expedientes con herramientas avanzadas de productividad como integración con WhatsApp, Google Calendar y funcionalidades PWA (Progressive Web App).

## 🚀 Características Principales

*   **Gestión de Clientes:** Base de datos completa, historial de casos, y carga de documentos.
*   **Expedientes Digitales:** Seguimiento del estado de causas, movimientos y vencimientos.
*   **Calendario Inteligente:** Sincronización bidireccional con Google Calendar para audiencias y plazos.
*   **Integración WhatsApp:** Envío de notificaciones automáticas y recordatorios a clientes desde la app.
*   **Dashboard Financiero:** Control de honorarios, gastos y facturación básica.
*   **100% PWA:** Instalable en dispositivos móviles (Android/iOS) y escritorio, con funcionamiento offline parcial.
*   **Seguridad:** Autenticación robusta, roles de usuario y encriptación de datos sensibles.

## 🛠️ Tecnologías Utilizadas

### Frontend
*   **Framework:** Angular 19+ (Standalone Components)
*   **UI Library:** PrimeNG + Tailwind CSS
*   **PWA:** @angular/service-worker
*   **Gestión de Estado:** Signals

### Backend
*   **Framework:** NestJS
*   **Base de Datos:** PostgreSQL (vía TypeORM/Prisma)
*   **Autenticación:** JWT + Passport
*   **Integraciones:** Google APIs, WhatsApp Web.js (u otra librería de integración).

---

## 🏁 Comenzando

### Pre-requisitos
*   Node.js (v18 o superior)
*   npm (v9 o superior)
*   PostgreSQL (local o en la nube)

### Instalación

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/legal-tech-app.git
    cd legal-tech-app
    ```

2.  **Configurar Backend:**
    ```bash
    cd backend
    npm install
    # Configurar variables de entorno .env (ver .env.example)
    npm run start:dev
    ```

3.  **Configurar Frontend:**
    ```bash
    cd ../legal-tech-app (o frontend)
    npm install
    npm start
    ```

4.  **Acceder:** Abrir `http://localhost:4200` en tu navegador.

---

## 📱 PWA (Progressive Web App)

Esta aplicación es completamente instalable.
*   **En Móvil:** Abre el menú del navegador y selecciona "Agregar a pantalla de inicio".
*   **En Escritorio:** Verás un ícono de instalación (+) en la barra de direcciones de Chrome/Edge.

**Actualizaciones Automáticas:** La app detectará nuevas versiones desplegadas y te invitará a actualizar con un solo clic.

---

## 🚢 Despliegue a Producción

Consulta la guía detallada [deployment_guide.md](./deployment_guide.md) para instrucciones paso a paso sobre cómo desplegar en:
*   **Frontend:** Vercel / Netlify
*   **Backend:** Render / Railway / VPS
*   **Base de Datos:** Neon.tech / Supabase

---

## 📄 Licencia

Este proyecto es propiedad privada de [Tu Nombre / Estudio]. Todos los derechos reservados.
