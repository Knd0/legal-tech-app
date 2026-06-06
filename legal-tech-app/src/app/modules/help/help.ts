import { Component, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';

interface SearchTopic {
  title: string;
  description: string;
  keywords: string;
  section: string;
}

@Component({
  selector: 'app-help',
  standalone: false,
  templateUrl: './help.html',
  styleUrl: './help.css',
})
export class Help implements AfterViewInit, OnDestroy {
  activeSection = 'intro';
  selectedCategory = 'all';
  searchQuery = '';
  private observer: IntersectionObserver | null = null;

  // Categories definition
  categories = [
    { id: 'all', label: 'Todos', icon: 'pi pi-th-large' },
    { id: 'general', label: 'General', icon: 'pi pi-compass' },
    { id: 'gestion', label: 'Gestión Procesal', icon: 'pi pi-briefcase' },
    { id: 'ia', label: 'Inteligencia Artificial', icon: 'pi pi-sparkles' },
    { id: 'facturacion', label: 'Facturación y Cuenta', icon: 'pi pi-receipt' }
  ];

  // Help sections definition
  sections = [
    { id: 'intro', label: 'Introducción', icon: 'pi pi-compass', category: 'general' },
    { id: 'dashboard', label: 'Panel de Control', icon: 'pi pi-home', category: 'gestion' },
    { id: 'clientes', label: 'Gestión de Clientes', icon: 'pi pi-users', category: 'gestion' },
    { id: 'expedientes', label: 'Expedientes y Kanban', icon: 'pi pi-briefcase', category: 'gestion' },
    { id: 'documentos', label: 'Gestión Documental', icon: 'pi pi-folder-open', category: 'gestion' },
    { id: 'ia', label: 'Copilot', icon: 'pi pi-sparkles', category: 'ia' },
    { id: 'calendario', label: 'Agenda y PDFs', icon: 'pi pi-calendar', category: 'gestion' },
    { id: 'afip', label: 'Facturación AFIP / ARCA', icon: 'pi pi-receipt', category: 'facturacion' },
    { id: 'suscripciones', label: 'Suscripciones y Pagos', icon: 'pi pi-credit-card', category: 'facturacion' },
    { id: 'configuracion', label: 'Ajustes y WhatsApp', icon: 'pi pi-cog', category: 'general' }
  ];

  // Search Database
  searchableTopics: SearchTopic[] = [
    {
      title: '¿Cómo vincular el bot de WhatsApp?',
      description: 'Guía paso a paso para escanear el QR o usar el código de teléfono para automatizar recordatorios.',
      keywords: 'whatsapp qr codigo vinculacion telefono bot sincronizar qr error spinner',
      section: 'configuracion'
    },
    {
      title: '¿Cómo funciona el Copilot?',
      description: 'Aprende a redactar demandas, resumir expedientes y calcular la probabilidad de éxito de tus causas con IA.',
      keywords: 'ia copiloto gemini openai resumen demanda redactar riesgos probabilidad exitos puntos fuertes debiles themis copilot',
      section: 'ia'
    },
    {
      title: '¿Cómo emitir facturas C oficiales con AFIP?',
      description: 'Pasos para delegar el servicio wsfe en la AFIP, configurar el Punto de Venta y emitir comprobantes.',
      keywords: 'afip factura arca cae punto de venta honorarios factura c delegar wsfe cuit arca',
      section: 'afip'
    },
    {
      title: '¿Cómo escanear notificaciones PDF para extraer plazos?',
      description: 'Sube un PDF de notificación judicial y deja que la IA calcule los plazos hábiles automáticamente.',
      keywords: 'calendario pdf notificacion plazo vencimiento escanear ia automatica dias habiles cedula',
      section: 'calendario'
    },
    {
      title: '¿Cómo subir y ver documentos asociados a un caso?',
      description: 'Almacena archivos en Cloudinary sin límites de peso y visualiza previews interactivos.',
      keywords: 'documento pdf subir cloudinary archivo preview imagen streaming ver visor',
      section: 'documentos'
    },
    {
      title: '¿Qué hacer si se bloquea la creación por suscripción?',
      description: 'Activa tu suscripción mensual mediante MercadoPago para desbloquear la carga de clientes y causas.',
      keywords: 'mercadopago suscripcion pago plan precio mensual gracia bloqueado mercadopago preapproval',
      section: 'suscripciones'
    },
    {
      title: '¿Cómo usar el tablero Kanban de expedientes?',
      description: 'Arrastra y suelta causas entre etapas procesales para organizar tu flujo de trabajo.',
      keywords: 'expediente kanban caratula juzgado fuero estado arrastrar mover columnas etapa',
      section: 'expedientes'
    },
    {
      title: '¿Cómo buscar clientes rápidamente con debouncer?',
      description: 'Optimiza la búsqueda en tiempo real que espera 300ms antes de consultar al servidor.',
      keywords: 'cliente debouncer buscador paginacion lazy listado nuevo telefono buscar',
      section: 'clientes'
    }
  ];

  // Simulator 1: Copilot
  selectedAiTab = 'draft';
  isAiGenerating = false;
  aiOutput = '';
  mockSuccessRate = 78;

  // Simulator 2: WhatsApp Bot
  whatsappSimState = 'idle'; // idle, sending, success
  whatsappSimText = '';

  // Simulator 3: PDF Scanner
  pdfSimState = 'idle'; // idle, reading, analyzed
  pdfResult = {
    title: '',
    description: '',
    deadline: 0,
    dueDate: ''
  };

  constructor(private el: ElementRef) {}

  ngAfterViewInit() {
    this.setupObserver();
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private setupObserver() {
    const options = {
      root: this.el.nativeElement.querySelector('main'),
      rootMargin: '-50% 0px -50% 0px',
      threshold: 0
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          if (id && this.sections.some(s => s.id === id)) {
            this.activeSection = id;
          }
        }
      });
    }, options);

    this.sections.forEach(section => {
      const element = document.getElementById(section.id);
      if (element) {
        this.observer?.observe(element);
      }
    });
  }

  scrollTo(sectionId: string) {
    this.activeSection = sectionId;
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Get filtered sections based on category
  getFilteredSections() {
    if (this.selectedCategory === 'all') {
      return this.sections;
    }
    return this.sections.filter(s => s.category === this.selectedCategory);
  }

  // Get search results
  getSearchResults() {
    if (!this.searchQuery.trim()) return [];
    const q = this.searchQuery.toLowerCase();
    return this.searchableTopics.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.keywords.toLowerCase().includes(q) || 
      t.description.toLowerCase().includes(q)
    );
  }

  // Simulator Actions: Copilot
  generateMockDraft(type: string) {
    this.isAiGenerating = true;
    this.aiOutput = '';
    
    let text = '';
    if (type === 'demanda') {
      text = `INICIA DEMANDA POR DAÑOS Y PERJUICIOS\n\nSeñor Juez:\n\nJuan Pérez, por derecho propio, con el patrocinio del Dr. Franco, constituyendo domicilio legal en calle San Martín 123... vengo a promover formal demanda ordinaria por daños y perjuicios contra María Gómez...\n\nOBJETO:\nQue vengo por la presente a solicitar que se condene a la parte demandada al pago de la suma que más adelante se detallará en concepto de indemnización por el accidente de tránsito ocurrido el día...`;
    } else if (type === 'contestacion') {
      text = `CONTESTA TRASLADO DE DEMANDA - OPONE EXCEPCIONES\n\nSeñor Juez:\n\nMaría Gómez, por derecho propio, con el patrocinio letrado... vengo en tiempo y forma a contestar el traslado de la demanda instaurada en mi contra, solicitando desde ya su total rechazo...\n\nNEGATIVAS PARTICULARES:\nNiego todos y cada uno de los hechos relatados por el actor que no sean materia de expresa confirmación. Niego especialmente que el vehículo de mi propiedad haya cruzado el semáforo en rojo...`;
    } else {
      text = `RESUMEN EJECUTIVO PROCESAL\n\nExpediente: Pérez c/ Gómez s/ Daños y Perjuicios\nEstado: Apertura a Prueba\n\n1. Resumen del conflicto: Reclamo indemnizatorio derivado de colisión vehicular en intersección semaforizada.\n2. Puntos clave a probar: Prioridad de paso de la actora y velocidad excesiva de la demandada.\n3. Estrategia sugerida: Ofrecer prueba pericial mecánica de inmediato y citar a los testigos presenciales declarados en sede penal.`;
    }

    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        this.aiOutput += text.charAt(i);
        i += 4; // Fast typing speed
      } else {
        this.aiOutput = text; // Complete
        this.isAiGenerating = false;
        clearInterval(interval);
      }
    }, 15);
  }

  // Simulator Actions: WhatsApp
  sendMockWhatsapp() {
    this.whatsappSimState = 'sending';
    setTimeout(() => {
      this.whatsappSimState = 'success';
      this.whatsappSimText = 'Estimado Juan Pérez, le recordamos que mañana 07-06-2026 vence el plazo procesal para presentar la documentación respaldatoria en su causa "Pérez c/ Gómez s/ Daños". Saludos cordiales, Estudio Jurídico Franco & Asoc.';
    }, 1500);
  }

  resetWhatsappMock() {
    this.whatsappSimState = 'idle';
    this.whatsappSimText = '';
  }

  // Simulator Actions: PDF Scanner
  simulatePdfScan() {
    this.pdfSimState = 'reading';
    setTimeout(() => {
      this.pdfSimState = 'analyzed';
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // 5 business days ~ 7 calendar days
      const formattedDate = futureDate.toISOString().split('T')[0];

      this.pdfResult = {
        title: 'Contestar Excepciones y Ofrecer Prueba',
        description: 'Traslado de las excepciones opuestas por la demandada por el plazo de 5 días hábiles.',
        deadline: 5,
        dueDate: formattedDate
      };
    }, 2000);
  }

  resetPdfMock() {
    this.pdfSimState = 'idle';
    this.pdfResult = {
      title: '',
      description: '',
      deadline: 0,
      dueDate: ''
    };
  }
}
