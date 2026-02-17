import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentsService, Documento } from '../../../core/services/documents.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-documents-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './documents-list.component.html',
  styleUrls: ['./documents-list.component.scss']
})
export class DocumentsListComponent implements OnInit {
  @Input() clientId?: string;
  @Input() expedienteId?: string;

  documentsService = inject(DocumentsService);
  documents = signal<Documento[]>([]);
  isUploading = signal<boolean>(false);

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
    if (file) {
      this.uploadFile(file);
    }
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
        console.error('Upload error', err);
        Swal.fire('Error', 'No se pudo subir el archivo', 'error');
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
                    Swal.fire('Eliminado', 'El archivo ha sido eliminado.', 'success');
                },
                error: (err) => Swal.fire('Error', 'No se pudo eliminar', 'error')
            });
        }
    });
  }

  getIconClass(mimeType: string): string {
      if (mimeType.includes('pdf')) return 'pi-file-pdf text-red-500';
      if (mimeType.includes('word') || mimeType.includes('officedocument')) return 'pi-file-word text-blue-500';
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
