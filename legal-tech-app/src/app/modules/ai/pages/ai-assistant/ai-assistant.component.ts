import { Component, inject, signal, computed } from '@angular/core';
import { AiService } from '../../../../core/services/ai.service';
import { ExpedienteService } from '../../../../core/services/expediente.service';
import Swal from 'sweetalert2';

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

  copyToClipboard() {
    navigator.clipboard.writeText(this.aiResponse());
    Swal.fire({
      icon: 'success',
      title: 'Copiado al portapapeles',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1500
    });
  }
}
