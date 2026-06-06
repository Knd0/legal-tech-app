import { Component, inject, signal, computed } from '@angular/core';
import { AiService } from '../../../../core/services/ai.service';
import { ExpedienteService } from '../../../../core/services/expediente.service';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';

@Component({
  selector: 'app-ai-assistant',
  standalone: false,
  templateUrl: './ai-assistant.component.html',
  styleUrl: './ai-assistant.component.scss'
})
export class AiAssistantComponent {
  private aiService = inject(AiService);
  private expedienteService = inject(ExpedienteService);

  // General query text mode
  queryText = signal<string>('');
  selectedContext = signal<string>('ANALISIS_ESCRITO');
  
  // Case selector options and inputs
  selectedExpedienteId = signal<string>('');
  tipoEscrito = signal<string>('CONTESTACION_DEMANDA');
  extraInstructions = signal<string>('');

  // Response signals
  aiResponse = signal<string>('');
  loading = signal<boolean>(false);

  // Risk analysis specific metrics
  successProbability = signal<number | null>(null);
  strongPoints = signal<string[]>([]);
  weakPoints = signal<string[]>([]);

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

  expedienteOptions = computed(() =>
    this.expedienteService.expedientes().map(e => ({
      label: `${e.nroExpediente} — ${e.caratula}`,
      value: e.id
    }))
  );

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
        this.aiService.generateDraft(expId, this.tipoEscrito(), this.extraInstructions()).subscribe({
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
}
