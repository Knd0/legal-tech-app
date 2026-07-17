import { Component, inject, signal, computed, effect, OnInit } from '@angular/core';
import { AiService } from '../../../../core/services/ai.service';
import { ExpedienteService } from '../../../../core/services/expediente.service';
import { ConfiguracionService } from '../../../../core/services/configuracion.service';
import { DocumentsService } from '../../../../core/services/documents.service';
import { LegalModelService } from '../../../../core/services/legal-model.service';
import { DeadlineService } from '../../../../core/services/deadline.service';
import { ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';

@Component({
  selector: 'app-ai-assistant',
  standalone: false,
  templateUrl: './ai-assistant.component.html',
  styleUrl: './ai-assistant.component.scss'
})
export class AiAssistantComponent implements OnInit {
  private aiService = inject(AiService);
  private expedienteService = inject(ExpedienteService);
  public configService = inject(ConfiguracionService);
  private documentsService = inject(DocumentsService);
  private legalModelService = inject(LegalModelService);
  private deadlineService = inject(DeadlineService);
  private route = inject(ActivatedRoute);

  // Tab control
  selectedTab = signal<'assistant' | 'pdf_analysis' | 'liquidation' | 'costs'>('assistant');

  // General query text mode
  queryText = signal<string>('');
  selectedContext = signal<string>('ANALISIS_ESCRITO');
  
  // Case selector options and inputs
  selectedExpedienteId = signal<string>('');
  tipoEscrito = signal<string>('CONTESTACION_DEMANDA');
  extraInstructions = signal<string>('');
  selectedModelId = signal<string>('');

  // Response signals
  aiResponse = signal<string>('');
  loading = signal<boolean>(false);

  // Templates list
  modelos = signal<any[]>([]);

  // Case documents list
  documentsList = signal<any[]>([]);
  selectedDocumentId = signal<string>('');
  pdfQuestion = signal<string>('');
  pdfResponse = signal<string>('');
  pdfLoading = signal<boolean>(false);
  extractedDeadlines = signal<any[]>([]);
  extractingDeadlines = signal<boolean>(false);

  // Interest calculator signals
  montoCapital = signal<number>(100000);
  fechaDesde = signal<Date>(new Date(new Date().setFullYear(new Date().getFullYear() - 1)));
  fechaHasta = signal<Date>(new Date());
  tipoTasaLiquidation = signal<string>('activa_bna');
  customPercentLiquidation = signal<number>(36);
  liqAccruedInterest = signal<number>(0);
  liqTotal = signal<number>(0);
  liqDays = signal<number>(0);
  liqResultText = signal<string>('');
  liqLoading = signal<boolean>(false);

  constructor() {
    effect(() => {
      const expId = this.selectedExpedienteId();
      if (expId) {
        this.loadDocuments(expId);
      } else {
        this.documentsList.set([]);
        this.selectedDocumentId.set('');
      }
    });
  }

  ngOnInit() {
    this.loadModels();

    // Check if query params have modelId
    this.route.queryParams.subscribe(params => {
      if (params['modelId']) {
        this.selectedModelId.set(params['modelId']);
        this.selectedContext.set('REDACCION_ESCRITO');
        this.selectedTab.set('assistant');
      }
    });
  }

  loadModels() {
    this.legalModelService.findAll('', '', '', 1, 100).subscribe({
      next: (res) => {
        this.modelos.set(res.data.map(m => ({ label: m.titulo, value: m.id })));
      },
      error: (err) => console.error(err)
    });
  }

  loadDocuments(expId: string) {
    this.documentsService.findAll(undefined, expId).subscribe({
      next: (docs) => {
        const pdfs = docs.filter(d => d.mimeType === 'application/pdf');
        this.documentsList.set(pdfs.map(d => ({ label: d.originalName, value: d.id })));
      },
      error: (err) => console.error(err)
    });
  }

  // Risk analysis specific metrics
  successProbability = signal<number | null>(null);
  strongPoints = signal<string[]>([]);
  weakPoints = signal<string[]>([]);

  // Cost Calculator signals
  montoReclamo = signal<number>(1000000); // Default $1,000,000 ARS
  jurisdiccion = signal<string>('nacion'); // 'nacion' | 'pba' | 'er' | 'custom'
  customTasaPercent = signal<number>(2.0); // Default 2%
  tipoProceso = signal<string>('civil'); // 'civil' | 'laboral' | 'sucesion' | 'divorcio' | 'amparo'
  requiereMediacion = signal<boolean>(false);
  requierePerito = signal<boolean>(false);
  cantidadNotificaciones = signal<number>(2);
  extraCostsDetails = signal<string>(''); // For the AI prompt
  valorJusManual = signal<number>(0);
  valorUmaManual = signal<number>(0);

  // AI response for costs
  costsAiResponse = signal<string>('');
  costsLoading = signal<boolean>(false);

  contextOptions = [
    { label: 'Analizar Escrito o Cláusula (General)', value: 'ANALISIS_ESCRITO' },
    { label: 'Redactar Escrito Judicial', value: 'REDACCION_ESCRITO' },
    { label: 'Resumir Expediente', value: 'RESUMEN_EXPEDIENTE' },
    { label: 'Análisis de Riesgo y Probabilidad', value: 'ANALISIS_RIESGO' }
  ];

  tipoEscritoOptions = [
    { label: 'Contestación de Demanda', value: 'CONTESTACION_DEMANDA' },
    { label: 'Demanda Inicial', value: 'DEMANDA' },
    { label: 'Telegrama / Carta Documento', value: 'CARTA_DOCUMENTO' },
    { label: 'Recurso de Apelación', value: 'RECURSO_APELACION' },
    { label: 'Solicitud de Copias / Medidas', value: 'SOLICITUD_MEDIDAS' }
  ];

  jurisdiccionOptions = [
    { label: 'Nación / Federal', value: 'nacion' },
    { label: 'Provincia de Buenos Aires (PBA)', value: 'pba' },
    { label: 'Entre Ríos', value: 'er' },
    { label: 'Personalizada (Porcentaje Tasa)', value: 'custom' }
  ];

  tipoProcesoOptions = [
    { label: 'Civil y Comercial', value: 'civil' },
    { label: 'Laboral', value: 'laboral' },
    { label: 'Proceso Sucesorio', value: 'sucesion' },
    { label: 'Divorcio', value: 'divorcio' },
    { label: 'Acción de Amparo', value: 'amparo' }
  ];

  expedienteOptions = computed(() =>
    this.expedienteService.expedientes().map(e => ({
      label: `${e.nroExpediente} — ${e.caratula}`,
      value: e.id
    }))
  );

  // Computed references to JUS and UMA
  activeValorJus = computed(() => {
    const manual = this.valorJusManual();
    return manual > 0 ? manual : this.configService.valorJus();
  });

  activeValorUma = computed(() => {
    const manual = this.valorUmaManual();
    return manual > 0 ? manual : this.configService.valorUma();
  });

  // Cost breakdowns
  tasaJusticia = computed(() => {
    const monto = this.montoReclamo() || 0;
    const jur = this.jurisdiccion();
    if (jur === 'nacion') {
      return monto * 0.03; // 3%
    } else if (jur === 'pba') {
      return monto * 0.022; // 2.2%
    } else if (jur === 'er') {
      return monto * 0.015; // 1.5%
    } else if (jur === 'custom') {
      return monto * ((this.customTasaPercent() || 0) / 100);
    }
    return 0;
  });

  sobretasaJusticia = computed(() => {
    const jur = this.jurisdiccion();
    if (jur === 'pba') {
      return this.tasaJusticia() * 0.10; // 10% de la tasa
    }
    return 0;
  });

  bonoLey = computed(() => {
    const jur = this.jurisdiccion();
    if (jur === 'nacion') {
      return 2500;
    } else if (jur === 'pba') {
      return 4500;
    } else if (jur === 'er') {
      return 3000;
    }
    return 0;
  });

  aportesPrevisionales = computed(() => {
    const jur = this.jurisdiccion();
    if (jur === 'pba' || jur === 'er') {
      return 0.5 * this.activeValorJus(); // 0.5 JUS
    }
    return 0;
  });

  gastosMediacion = computed(() => {
    if (!this.requiereMediacion()) return 0;
    const jur = this.jurisdiccion();
    if (jur === 'nacion') {
      return 2 * this.activeValorUma(); // 2 UMA
    } else if (jur === 'pba' || jur === 'er') {
      return 2 * this.activeValorJus(); // 2 JUS
    }
    return 25000; // Custom flat
  });

  gastosNotificacion = computed(() => {
    const cant = this.cantidadNotificaciones() || 0;
    return cant * 1500; // $1,500 ARS per notification
  });

  adelantoPerito = computed(() => {
    if (!this.requierePerito()) return 0;
    const jur = this.jurisdiccion();
    if (jur === 'nacion') {
      return 5 * this.activeValorUma(); // 5 UMA
    } else if (jur === 'pba' || jur === 'er') {
      return 5 * this.activeValorJus(); // 5 JUS
    }
    return 50000; // Custom flat
  });

  totalGastosEstimados = computed(() => {
    return this.tasaJusticia() +
           this.sobretasaJusticia() +
           this.bonoLey() +
           this.aportesPrevisionales() +
           this.gastosMediacion() +
           this.gastosNotificacion() +
           this.adelantoPerito();
  });

  // Attorney fee suggestions
  honorariosMinimos = computed(() => {
    const monto = this.montoReclamo() || 0;
    const jur = this.jurisdiccion();
    const tipo = this.tipoProceso();
    const jus = this.activeValorJus();
    const uma = this.activeValorUma();

    if (jur === 'nacion') {
      if (tipo === 'civil' || tipo === 'laboral') {
        const pct = monto * 0.11;
        const minVal = 10 * uma;
        return pct > minVal ? pct : minVal;
      } else if (tipo === 'sucesion') {
        const pct = monto * 0.06;
        const minVal = 15 * uma;
        return pct > minVal ? pct : minVal;
      } else if (tipo === 'divorcio') {
        return 15 * uma;
      } else if (tipo === 'amparo') {
        return 20 * uma;
      }
    } else if (jur === 'pba') {
      if (tipo === 'civil' || tipo === 'laboral') {
        const pct = monto * 0.08;
        const minVal = 10 * jus;
        return pct > minVal ? pct : minVal;
      } else if (tipo === 'sucesion') {
        const pct = monto * 0.06;
        const minVal = 15 * jus;
        return pct > minVal ? pct : minVal;
      } else if (tipo === 'divorcio') {
        return 15 * jus;
      } else if (tipo === 'amparo') {
        return 20 * jus;
      }
    } else if (jur === 'er') {
      if (tipo === 'civil' || tipo === 'laboral') {
        const pct = monto * 0.10;
        const minVal = 10 * jus;
        return pct > minVal ? pct : minVal;
      } else if (tipo === 'sucesion') {
        const pct = monto * 0.08;
        const minVal = 15 * jus;
        return pct > minVal ? pct : minVal;
      } else if (tipo === 'divorcio') {
        return 15 * jus;
      } else if (tipo === 'amparo') {
        return 20 * jus;
      }
    } else { // Custom
      if (tipo === 'civil' || tipo === 'laboral') {
        return monto * 0.10;
      } else if (tipo === 'sucesion') {
        return monto * 0.07;
      } else if (tipo === 'divorcio') {
        return 150000;
      } else if (tipo === 'amparo') {
        return 200000;
      }
    }
    return 0;
  });

  honorariosMaximos = computed(() => {
    const monto = this.montoReclamo() || 0;
    const jur = this.jurisdiccion();
    const tipo = this.tipoProceso();
    const jus = this.activeValorJus();
    const uma = this.activeValorUma();

    if (jur === 'nacion') {
      if (tipo === 'civil' || tipo === 'laboral') {
        const pct = monto * 0.22;
        const minVal = 10 * uma;
        return pct > minVal ? pct : minVal;
      } else if (tipo === 'sucesion') {
        const pct = monto * 0.165;
        const minVal = 15 * uma;
        return pct > minVal ? pct : minVal;
      } else if (tipo === 'divorcio') {
        return 30 * uma;
      } else if (tipo === 'amparo') {
        return 40 * uma;
      }
    } else if (jur === 'pba') {
      if (tipo === 'civil' || tipo === 'laboral') {
        const pct = monto * 0.25;
        const minVal = 10 * jus;
        return pct > minVal ? pct : minVal;
      } else if (tipo === 'sucesion') {
        const pct = monto * 0.20;
        const minVal = 15 * jus;
        return pct > minVal ? pct : minVal;
      } else if (tipo === 'divorcio') {
        return 30 * jus;
      } else if (tipo === 'amparo') {
        return 40 * jus;
      }
    } else if (jur === 'er') {
      if (tipo === 'civil' || tipo === 'laboral') {
        const pct = monto * 0.25;
        const minVal = 10 * jus;
        return pct > minVal ? pct : minVal;
      } else if (tipo === 'sucesion') {
        const pct = monto * 0.15;
        const minVal = 15 * jus;
        return pct > minVal ? pct : minVal;
      } else if (tipo === 'divorcio') {
        return 30 * jus;
      } else if (tipo === 'amparo') {
        return 40 * jus;
      }
    } else { // Custom
      if (tipo === 'civil' || tipo === 'laboral') {
        return monto * 0.20;
      } else if (tipo === 'sucesion') {
        return monto * 0.15;
      } else if (tipo === 'divorcio') {
        return 300000;
      } else if (tipo === 'amparo') {
        return 400000;
      }
    }
    return 0;
  });

  onAnalyze() {
    const context = this.selectedContext();

    if (context === 'ANALISIS_ESCRITO') {
      const text = this.queryText().trim();
      if (!text) {
        Swal.fire('Error', 'Por favor, ingrese el texto que desea analizar.', 'error');
        return;
      }

      this.loading.set(true);
      this.aiResponse.set('');
      this.successProbability.set(null);
      this.strongPoints.set([]);
      this.weakPoints.set([]);

      this.aiService.analyze(text, 'General').subscribe({
        next: (res) => {
          this.aiResponse.set(res.analysis);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to run AI analysis', err);
          this.loading.set(false);
          const errorMsg = err?.error?.message || 'Ocurrió un error al intentar comunicar con el servidor.';
          Swal.fire('Error', errorMsg, 'error');
        }
      });
    } else {
      const expId = this.selectedExpedienteId();
      if (!expId) {
        Swal.fire('Error', 'Por favor, seleccione un expediente.', 'error');
        return;
      }

      this.loading.set(true);
      this.aiResponse.set('');
      this.successProbability.set(null);
      this.strongPoints.set([]);
      this.weakPoints.set([]);

      if (context === 'REDACCION_ESCRITO') {
        this.aiService.generateDraft(expId, this.tipoEscrito(), this.extraInstructions(), this.selectedModelId()).subscribe({
          next: (res) => {
            this.aiResponse.set(res.draft);
            this.loading.set(false);
          },
          error: (err) => {
            console.error('Failed to generate draft', err);
            this.loading.set(false);
            const errorMsg = err?.error?.message || 'Ocurrió un error al intentar generar el borrador.';
            Swal.fire('Error', errorMsg, 'error');
          }
        });
      } else if (context === 'RESUMEN_EXPEDIENTE') {
        this.aiService.summarizeExpediente(expId).subscribe({
          next: (res) => {
            this.aiResponse.set(res.summary);
            this.loading.set(false);
          },
          error: (err) => {
            console.error('Failed to summarize expediente', err);
            this.loading.set(false);
            const errorMsg = err?.error?.message || 'Ocurrió un error al intentar resumir el expediente.';
            Swal.fire('Error', errorMsg, 'error');
          }
        });
      } else if (context === 'ANALISIS_RIESGO') {
        this.aiService.analyzeRisk(expId).subscribe({
          next: (res) => {
            this.aiResponse.set(res.riskAnalysis);
            this.successProbability.set(res.successProbability);
            this.strongPoints.set(res.strongPoints);
            this.weakPoints.set(res.weakPoints);
            this.loading.set(false);
          },
          error: (err) => {
            console.error('Failed to analyze risk', err);
            this.loading.set(false);
            const errorMsg = err?.error?.message || 'Ocurrió un error al intentar analizar el riesgo.';
            Swal.fire('Error', errorMsg, 'error');
          }
        });
      }
    }
  }

  clear() {
    this.queryText.set('');
    this.selectedExpedienteId.set('');
    this.extraInstructions.set('');
    this.aiResponse.set('');
    this.successProbability.set(null);
    this.strongPoints.set([]);
    this.weakPoints.set([]);
  }

  onAnalyzeCosts() {
    this.costsLoading.set(true);
    this.costsAiResponse.set('');

    const requestData = {
      montoReclamo: this.montoReclamo() || 0,
      jurisdiccion: this.jurisdiccion(),
      tipoProceso: this.tipoProceso(),
      requiereMediacion: this.requiereMediacion(),
      requierePerito: this.requierePerito(),
      cantidadNotificaciones: this.cantidadNotificaciones() || 0,
      extraDetails: this.extraCostsDetails(),
      valorJus: this.activeValorJus(),
      valorUma: this.activeValorUma()
    };

    this.aiService.analyzeCosts(requestData).subscribe({
      next: (res) => {
        this.costsAiResponse.set(res.analysis);
        this.costsLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to run AI costs analysis', err);
        this.costsLoading.set(false);
        const errorMsg = err?.error?.message || 'Ocurrió un error al intentar calcular con IA.';
        Swal.fire('Error', errorMsg, 'error');
      }
    });
  }

  clearCosts() {
    this.montoReclamo.set(1000000);
    this.jurisdiccion.set('nacion');
    this.customTasaPercent.set(2.0);
    this.tipoProceso.set('civil');
    this.requiereMediacion.set(false);
    this.requierePerito.set(false);
    this.cantidadNotificaciones.set(2);
    this.extraCostsDetails.set('');
    this.valorJusManual.set(0);
    this.valorUmaManual.set(0);
    this.costsAiResponse.set('');
  }

  private cleanMarkdown(md: string): string {
    let txt = md;
    // Remove headers
    txt = txt.replace(/^#+\s+/gm, '');
    // Remove bold/italic markers
    txt = txt.replace(/\*\*/g, '');
    txt = txt.replace(/\*/g, '');
    return txt;
  }

  private convertMarkdownToHtml(md: string): string {
    let html = md;
    
    // Escape HTML special characters
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
      
    // Headings
    html = html.replace(/^### (.*?)$/gm, '<h3 style="font-size: 14px; font-weight: bold; margin-top: 12px; margin-bottom: 6px;">$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2 style="font-size: 16px; font-weight: bold; margin-top: 16px; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1 style="font-size: 20px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #1a365d;">$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Lists
    html = html.replace(/^\* (.*?)$/gm, '<li>$1</li>');
    html = html.replace(/^- (.*?)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*?<\/li>)+/g, '<ul style="margin-top: 4px; margin-bottom: 8px; padding-left: 20px;">$&</ul>');
    
    // Line breaks / paragraphs
    html = html.replace(/\n/g, '<br>');
    
    return `<html><body><div style="font-family: Arial, sans-serif; line-height: 1.6; color: #2d3748;">${html}</div></body></html>`;
  }

  copyCleanText() {
    const clean = this.cleanMarkdown(this.aiResponse());
    navigator.clipboard.writeText(clean);
    Swal.fire({
      icon: 'success',
      title: 'Texto limpio copiado',
      text: 'Se han eliminado asteriscos e indicadores markdown.',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000
    });
  }

  copyFormattedText() {
    const md = this.aiResponse();
    const html = this.convertMarkdownToHtml(md);
    const text = this.cleanMarkdown(md);

    const blobHtml = new Blob([html], { type: 'text/html' });
    const blobText = new Blob([text], { type: 'text/plain' });

    try {
      const item = new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText
      });
      navigator.clipboard.write([item]);
      Swal.fire({
        icon: 'success',
        title: 'Copiado para Word / Docs',
        text: '¡Listo para pegar preservando el formato y títulos!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
      });
    } catch (err) {
      console.warn('ClipboardItem failed, falling back to plain copy:', err);
      navigator.clipboard.writeText(text);
      Swal.fire({
        icon: 'success',
        title: 'Copiado como texto plano',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500
      });
    }
  }

  exportToPdf() {
    const doc = new jsPDF();
    const cleanText = this.cleanMarkdown(this.aiResponse());
    const lines = doc.splitTextToSize(cleanText, 180);
    
    // Header styling
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(26, 54, 93); // Dark blue
    doc.text("Copilot - Reporte", 15, 20);
    
    // Line separator
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 24, 195, 24);
    
    // Body Text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(45, 55, 72); // Charcoal
    
    let y = 32;
    const pageHeight = doc.internal.pageSize.height;
    
    for (let i = 0; i < lines.length; i++) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines[i], 15, y);
      y += 6.5;
    }
    
    doc.save("analisis-copilot.pdf");
    
    Swal.fire({
      icon: 'success',
      title: 'Reporte PDF descargado',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1500
    });
  }

  copyCleanCostsText() {
    const clean = this.cleanMarkdown(this.costsAiResponse());
    navigator.clipboard.writeText(clean);
    Swal.fire({
      icon: 'success',
      title: 'Texto limpio copiado',
      text: 'Se han eliminado asteriscos e indicadores markdown.',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000
    });
  }

  copyFormattedCostsText() {
    const md = this.costsAiResponse();
    const html = this.convertMarkdownToHtml(md);
    const text = this.cleanMarkdown(md);

    const blobHtml = new Blob([html], { type: 'text/html' });
    const blobText = new Blob([text], { type: 'text/plain' });

    try {
      const item = new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText
      });
      navigator.clipboard.write([item]);
      Swal.fire({
        icon: 'success',
        title: 'Copiado para Word / Docs',
        text: '¡Listo para pegar preservando el formato y títulos!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
      });
    } catch (err) {
      console.warn('ClipboardItem failed, falling back to plain copy:', err);
      navigator.clipboard.writeText(text);
      Swal.fire({
        icon: 'success',
        title: 'Copiado como texto plano',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500
      });
    }
  }

  exportCostsToPdf() {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Header styling
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(26, 54, 93); // Dark blue
    doc.text("THEMIS", 15, 20);
    
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 120);
    doc.text("SISTEMA DE GESTIÓN JURÍDICA & COPILOT", 15, 24);
    
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, pageWidth - 50, 20);
    
    // Line separator
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 27, pageWidth - 15, 27);
    
    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("REPORTE PREDICTIVO DE COSTOS DE LITIGIO", 15, 36);
    
    // Parameters
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("1. PARÁMETROS DEL CASO", 15, 45);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    
    const formatCurrency = (val: number) => `$${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS`;
    
    const jurLabel = this.jurisdiccionOptions.find(o => o.value === this.jurisdiccion())?.label || this.jurisdiccion().toUpperCase();
    const procLabel = this.tipoProcesoOptions.find(o => o.value === this.tipoProceso())?.label || this.tipoProceso().toUpperCase();
    
    const params = [
      `Monto de Reclamo: ${formatCurrency(this.montoReclamo())}`,
      `Jurisdicción: ${jurLabel}`,
      `Tipo de Proceso: ${procLabel}`,
      `Mediación Previa: ${this.requiereMediacion() ? 'Sí' : 'No'}`,
      `Peritajes Requeridos: ${this.requierePerito() ? 'Sí' : 'No'}`,
      `Cantidad de Notificaciones: ${this.cantidadNotificaciones()}`,
      `Valor Ref. JUS: ${formatCurrency(this.activeValorJus())} | Valor Ref. UMA: ${formatCurrency(this.activeValorUma())}`
    ];
    
    let py = 52;
    params.forEach((p, idx) => {
      const col = idx % 2;
      const x = col === 0 ? 15 : 110;
      doc.text(p, x, py);
      if (col === 1 || idx === params.length - 1) {
        py += 5;
      }
    });
    
    // Breakdown Table Title
    py += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("2. DESGLOSE DE COSTOS ESTIMADOS", 15, py);
    
    // Table Headers
    py += 6;
    doc.setFillColor(241, 245, 249);
    doc.rect(15, py - 4, pageWidth - 30, 6, "F");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text("Concepto", 17, py);
    doc.text("Referencia", 85, py);
    doc.text("Monto Estimado", pageWidth - 45, py);
    
    py += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    
    const tableRows = [
      { name: "Tasa de Justicia", ref: this.jurisdiccion() === 'custom' ? `${this.customTasaPercent()}% del reclamo` : (this.jurisdiccion() === 'nacion' ? '3% del reclamo' : (this.jurisdiccion() === 'pba' ? '2.2% del reclamo' : '1.5% del reclamo')), val: this.tasaJusticia() },
      { name: "Sobretasa de Justicia", ref: this.jurisdiccion() === 'pba' ? '10% de la Tasa (PBA)' : 'No aplica', val: this.sobretasaJusticia() },
      { name: "Bono Ley / Instrumental", ref: `Fijo según jurisdicción`, val: this.bonoLey() },
      { name: "Aportes Previsionales Inicio", ref: this.jurisdiccion() === 'pba' || this.jurisdiccion() === 'er' ? '0.5 JUS anticipo' : 'No aplica', val: this.aportesPrevisionales() },
      { name: "Gastos de Mediación", ref: this.requiereMediacion() ? (this.jurisdiccion() === 'nacion' ? '2 UMA' : '2 JUS / Fijo') : 'No requiere', val: this.gastosMediacion() },
      { name: "Gastos de Notificación", ref: `${this.cantidadNotificaciones()} notificaciones`, val: this.gastosNotificacion() },
      { name: "Adelanto de Peritos", ref: this.requierePerito() ? (this.jurisdiccion() === 'nacion' ? '5 UMA anticipo' : '5 JUS / Fijo') : 'No requiere', val: this.adelantoPerito() },
    ];
    
    tableRows.forEach(row => {
      doc.text(row.name, 17, py);
      doc.text(row.ref, 85, py);
      doc.text(formatCurrency(row.val), pageWidth - 45, py);
      doc.setDrawColor(241, 245, 249);
      doc.line(15, py + 2, pageWidth - 15, py + 2);
      py += 6;
    });
    
    // Total row
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("TOTAL GASTOS INICIALES ESTIMADOS", 17, py);
    doc.text(formatCurrency(this.totalGastosEstimados()), pageWidth - 45, py);
    
    // Attorney fees section
    py += 8;
    doc.text("3. ESTIMACIÓN DE HONORARIOS PROFESIONALES (SUGERIDO DE LEY)", 15, py);
    
    py += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    
    doc.text("Honorarios Mínimos Sugeridos:", 17, py);
    doc.text(formatCurrency(this.honorariosMinimos()), pageWidth - 45, py);
    
    py += 5;
    doc.text("Honorarios Máximos Sugeridos:", 17, py);
    doc.text(formatCurrency(this.honorariosMaximos()), pageWidth - 45, py);
    
    // Divider before AI Report
    py += 7;
    doc.setDrawColor(226, 232, 240);
    doc.line(15, py, pageWidth - 15, py);
    
    py += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("4. ANÁLISIS ESTRATÉGICO & RECOMENDACIONES (IA)", 15, py);
    
    py += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(45, 55, 72);
    
    if (this.costsAiResponse()) {
      const cleanText = this.cleanMarkdown(this.costsAiResponse());
      const lines = doc.splitTextToSize(cleanText, pageWidth - 30);
      
      for (let i = 0; i < lines.length; i++) {
        if (py > pageHeight - 15) {
          doc.addPage();
          py = 20;
        }
        doc.text(lines[i], 15, py);
        py += 5.5;
      }
    } else {
      doc.setFont("helvetica", "italic");
      doc.text("No se ha generado el reporte de IA aún.", 17, py);
    }
    
    doc.save(`reporte-costos-${this.jurisdiccion()}-${this.tipoProceso()}.pdf`);
    
    Swal.fire({
      icon: 'success',
      title: 'Reporte PDF de Costos descargado',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1500
    });
  }

  analyzePdf() {
    const docId = this.selectedDocumentId();
    const q = this.pdfQuestion();
    if (!docId) {
      Swal.fire('Error', 'Por favor, seleccione un documento PDF.', 'error');
      return;
    }
    if (!q || q.trim() === '') {
      Swal.fire('Error', 'Por favor, escriba una pregunta sobre el documento.', 'error');
      return;
    }

    this.pdfLoading.set(true);
    this.pdfResponse.set('');
    
    this.aiService.analyzePdf(docId, q).subscribe({
      next: (res) => {
        this.pdfResponse.set(res.analysis);
        this.pdfLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.pdfLoading.set(false);
        Swal.fire('Error', 'No se pudo realizar el análisis del archivo.', 'error');
      }
    });
  }

  extractDeadlinesFromPdf() {
    const docId = this.selectedDocumentId();
    if (!docId) {
      Swal.fire('Error', 'Por favor, seleccione un documento PDF.', 'error');
      return;
    }

    this.extractingDeadlines.set(true);
    this.extractedDeadlines.set([]);

    this.aiService.extractDeadlines(docId).subscribe({
      next: (res) => {
        this.extractedDeadlines.set(res);
        this.extractingDeadlines.set(false);
        if (res.length === 0) {
          Swal.fire('Sincronización', 'No se detectaron plazos ni audiencias en este documento.', 'info');
        }
      },
      error: (err) => {
        console.error(err);
        this.extractingDeadlines.set(false);
        Swal.fire('Error', 'No se pudieron extraer los plazos del documento.', 'error');
      }
    });
  }

  addDeadlineFromExtraction(dl: any) {
    const expId = this.selectedExpedienteId();
    if (!expId) return;

    const data = {
      expedienteId: expId,
      fechaVencimiento: new Date(dl.fechaVencimiento),
      horaVencimiento: dl.horaVencimiento || undefined,
      titulo: dl.titulo,
      descripcion: dl.descripcion || '',
      tipo: dl.tipo || 'VENCIMIENTO_PLAZO',
      esPerentorio: true,
      estado: 'PENDIENTE' as any
    };

    this.deadlineService.addDeadline(data);
    Swal.fire({
      icon: 'success',
      title: 'Agendado',
      text: `El plazo "${dl.titulo}" ha sido guardado en tu calendario con éxito.`,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    });
  }

  calculateLiquidation() {
    const cap = this.montoCapital() || 0;
    const desde = this.fechaDesde();
    const hasta = this.fechaHasta();
    const tipo = this.tipoTasaLiquidation();

    if (!desde || !hasta) {
      Swal.fire('Error', 'Por favor seleccione ambas fechas.', 'error');
      return;
    }

    const diffTime = Math.abs(hasta.getTime() - desde.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    this.liqDays.set(diffDays);

    let annualRate = 0;
    if (tipo === 'activa_bna') {
      annualRate = 54;
    } else if (tipo === 'pasiva_pba') {
      annualRate = 42;
    } else if (tipo === 'custom_anual') {
      annualRate = this.customPercentLiquidation() || 0;
    } else if (tipo === 'custom_mensual') {
      annualRate = (this.customPercentLiquidation() || 0) * 12;
    }

    const dailyRate = annualRate / 100 / 365;
    const interest = cap * dailyRate * diffDays;
    const total = cap + interest;

    this.liqAccruedInterest.set(interest);
    this.liqTotal.set(total);

    const tasaStr = tipo === 'custom_mensual' 
      ? `${this.customPercentLiquidation()}% mensual (${annualRate}% anual)`
      : `${annualRate}% anual`;

    this.liqResultText.set(
      `### Planilla de Liquidación Judicial\n\n` +
      `* **Capital de Origen:** $${cap.toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n` +
      `* **Fecha de Inicio:** ${desde.toLocaleDateString('es-AR')}\n` +
      `* **Fecha de Cierre:** ${hasta.toLocaleDateString('es-AR')}\n` +
      `* **Días de Interés:** ${diffDays} días\n` +
      `* **Tasa Aplicada:** ${tasaStr} (${(dailyRate * 100).toFixed(4)}% diaria)\n\n` +
      `| Concepto | Monto |\n` +
      `| :--- | :--- |\n` +
      `| Capital Histórico | $${cap.toLocaleString('es-AR', { minimumFractionDigits: 2 })} |\n` +
      `| Intereses Devengados | $${interest.toLocaleString('es-AR', { minimumFractionDigits: 2 })} |\n` +
      `| **MONTO TOTAL LIQUIDADO** | **$${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}** |\n\n` +
      `*Nota: Esta liquidación ha sido calculada de forma interactiva bajo el sistema de capitalización simple.*`
    );
  }

  generateLiquidationDraft() {
    const text = this.liqResultText();
    if (!text) return;

    const expId = this.selectedExpedienteId();
    if (!expId) {
      Swal.fire('Seleccionar caso', 'Por favor, seleccione un expediente en el selector lateral.', 'warning');
      return;
    }

    this.liqLoading.set(true);

    const prompt = `Eres un abogado procesal de Argentina. Redacta un escrito judicial formal titulado "PRESENTA PLANILLA DE LIQUIDACION" para presentar ante el juzgado, basándote en los datos de esta planilla de cálculo:\n\n${text}\n\nEstructura el escrito con la cabecera correspondiente, el objeto, el desglose de la liquidación en forma de tabla limpia, la solicitud de traslado a la contraria y el petitorio final. Devuelve únicamente el escrito en Markdown limpio.`;
    
    this.aiService.analyze(prompt, 'REDACCION_ESCRITO').subscribe({
      next: (res) => {
        this.selectedTab.set('assistant');
        this.selectedContext.set('REDACCION_ESCRITO');
        this.aiResponse.set(res.analysis);
        this.liqLoading.set(false);
        Swal.fire({
          icon: 'success',
          title: 'Escrito Generado',
          text: 'Se ha cargado la planilla en la pestaña del Asistente.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
      },
      error: (err) => {
        console.error(err);
        this.liqLoading.set(false);
        Swal.fire('Error', 'No se pudo generar el escrito judicial de liquidación.', 'error');
      }
    });
  }
}
