import { Component, Input, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentsService, Documento } from '../../../core/services/documents.service';
import Swal from 'sweetalert2';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'text/plain',
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

@Component({
  selector: 'app-documents-list',
  standalone: true,
  imports: [CommonModule, DialogModule],
  templateUrl: './documents-list.component.html',
  styleUrls: ['./documents-list.component.scss']
})
export class DocumentsListComponent implements OnInit, OnDestroy {
  @Input() clientId?: string;
  @Input() expedienteId?: string;

  documentsService = inject(DocumentsService);
  private sanitizer = inject(DomSanitizer);
  documents = signal<Documento[]>([]);
  isUploading = signal<boolean>(false);
  isDragging = signal<boolean>(false);

  previewDoc = signal<Documento | null>(null);
  private _previewUrl = signal<string | null>(null);
  previewLoading = signal<boolean>(false);
  private objectUrls: string[] = [];

  safePreviewUrl = computed<SafeResourceUrl | null>(() => {
    const url = this._previewUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  ngOnInit() {
    this.loadDocuments();
  }

  loadDocuments() {
    this.documentsService.findAll(this.clientId, this.expedienteId).subscribe({
      next: (docs) => this.documents.set(docs),
      error: (err) => console.error('Error loading docs', err)
    });
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) this.validateAndUpload(file);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.validateAndUpload(file);
  }

  validateAndUpload(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      Swal.fire('Tipo no permitido', 'Solo se aceptan PDF, Word, Excel, imágenes y texto plano.', 'warning');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      Swal.fire('Archivo muy grande', 'El tamaño máximo permitido es 10 MB.', 'warning');
      return;
    }
    this.uploadFile(file);
  }

  uploadFile(file: File) {
    this.isUploading.set(true);
    this.documentsService.upload(file, this.clientId, this.expedienteId).subscribe({
      next: () => {
        this.isUploading.set(false);
        this.loadDocuments();
        Swal.fire({
            icon: 'success',
            title: 'Archivo subido',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
      },
      error: (err) => {
        this.isUploading.set(false);
        const msg = err?.error?.message || 'No se pudo subir el archivo';
        Swal.fire('Error', msg, 'error');
      }
    });
  }

  deleteDocument(id: string) {
    Swal.fire({
        title: '¿Eliminar archivo?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar'
    }).then((result) => {
        if (result.isConfirmed) {
            this.documentsService.delete(id).subscribe({
                next: () => {
                    this.loadDocuments();
                    Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1500, showConfirmButton: false });
                },
                error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
            });
        }
    });
  }

  downloadDoc(doc: Documento) {
    this.documentsService.getBlob(doc.id).subscribe(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = doc.originalName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    });
  }

  canPreview(mimeType: string): boolean {
    return mimeType.startsWith('image/') || mimeType === 'application/pdf';
  }

  openPreview(doc: Documento) {
    this.previewDoc.set(doc);
    this.previewLoading.set(true);
    this._previewUrl.set(null);

    this.documentsService.getBlob(doc.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.objectUrls.push(url);
        this._previewUrl.set(url);
        this.previewLoading.set(false);
      },
      error: () => {
        this.previewLoading.set(false);
        Swal.fire('Error', 'No se pudo cargar la previsualización.', 'error');
        this.previewDoc.set(null);
      }
    });
  }

  closePreview() {
    this.previewDoc.set(null);
    this._previewUrl.set(null);
  }

  ngOnDestroy() {
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
  }

  getIconClass(mimeType: string): string {
      if (mimeType.includes('pdf')) return 'pi-file-pdf text-red-500';
      if (mimeType.includes('word') || mimeType.includes('officedocument.wordprocessing')) return 'pi-file-word text-blue-500';
      if (mimeType.includes('image')) return 'pi-image text-purple-500';
      if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'pi-file-excel text-green-500';
      return 'pi-file text-slate-400';
  }

  formatSize(bytes: number): string {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getDownloadUrl(id: string) {
      return this.documentsService.downloadUrl(id);
  }
}
