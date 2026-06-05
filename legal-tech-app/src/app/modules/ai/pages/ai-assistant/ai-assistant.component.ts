import { Component, inject, signal } from '@angular/core';
import { AiService } from '../../../../core/services/ai.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-ai-assistant',
  standalone: false,
  templateUrl: './ai-assistant.component.html',
  styleUrl: './ai-assistant.component.scss'
})
export class AiAssistantComponent {
  private aiService = inject(AiService);

  queryText = signal<string>('');
  selectedContext = signal<string>('ANALISIS_ESCRITO');
  aiResponse = signal<string>('');
  loading = signal<boolean>(false);

  contextOptions = [
    { label: 'Analizar Escrito o Cláusula', value: 'ANALISIS_ESCRITO' },
    { label: 'Resumir Causa o Expediente', value: 'RESUMEN_CAUSA' },
    { label: 'Propuesta de Redacción Legal', value: 'REDACCION_LEGAL' },
    { label: 'Corregir Ortografía y Estilo', value: 'CORRECCION_ESTILO' }
  ];

  onAnalyze() {
    const text = this.queryText().trim();
    if (!text) {
      Swal.fire('Error', 'Por favor, ingrese el texto que desea analizar o redactar.', 'error');
      return;
    }

    const contextLabel = this.contextOptions.find(o => o.value === this.selectedContext())?.label || this.selectedContext();

    this.loading.set(true);
    this.aiResponse.set('');

    this.aiService.analyze(text, contextLabel).subscribe({
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
  }

  clear() {
    this.queryText.set('');
    this.aiResponse.set('');
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
