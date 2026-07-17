import { Component, OnInit, signal } from '@angular/core';
import { LegalModelService, LegalModel } from '../../../../core/services/legal-model.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modelos-list',
  standalone: false,
  templateUrl: './modelos-list.component.html',
})
export class ModelosListComponent implements OnInit {
  modelos = signal<LegalModel[]>([]);
  total = signal(0);
  page = signal(1);
  limit = 10;

  searchQuery = '';
  selectedFuero = '';
  selectedTipo = '';

  fueros: string[] = [
    'Civil y Comercial',
    'Laboral',
    'Familia',
    'Penal',
    'Contencioso Administrativo',
    'Federal',
    'Ejecuciones Fiscales',
    'Concursal',
  ];

  tiposEscritos: string[] = [
    'Demanda',
    'Contestación',
    'Amparo',
    'Apelación',
    'Cédula',
    'Escrito Simple',
    'Otro'
  ];

  constructor(
    private legalModelService: LegalModelService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadModelos();
  }

  loadModelos(): void {
    this.legalModelService.findAll(
      this.searchQuery,
      this.selectedFuero,
      this.selectedTipo,
      this.page(),
      this.limit
    ).subscribe({
      next: (res) => {
        this.modelos.set(res.data);
        this.total.set(res.total);
      },
      error: (err) => {
        console.error('Error al cargar modelos:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar los modelos de escritos.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
      }
    });
  }

  onSearch(): void {
    this.page.set(1);
    this.loadModelos();
  }

  onClearFilters(): void {
    this.searchQuery = '';
    this.selectedFuero = '';
    this.selectedTipo = '';
    this.page.set(1);
    this.loadModelos();
  }

  onPageChange(event: any): void {
    const newPage = (event.first / event.rows) + 1;
    this.page.set(newPage);
    this.loadModelos();
  }

  copyToClipboard(content: string): void {
    navigator.clipboard.writeText(content).then(() => {
      Swal.fire({
        icon: 'success',
        title: 'Copiado',
        text: 'Contenido copiado al portapapeles.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
      });
    });
  }

  deleteModel(id: string): void {
    Swal.fire({
      title: '¿Está seguro?',
      text: 'Esta acción no se puede deshacer y eliminará permanentemente la plantilla.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--accent-terracotta)',
      cancelButtonColor: '#aaa',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.legalModelService.delete(id).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Eliminado',
              text: 'La plantilla ha sido eliminada con éxito.',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3000
            });
            this.loadModelos();
          },
          error: (err) => {
            console.error(err);
            Swal.fire('Error', 'No se pudo eliminar el modelo.', 'error');
          }
        });
      }
    });
  }

  draftWithCopilot(modelId: string): void {
    this.router.navigate(['/copilot'], { queryParams: { modelId } });
  }

  splitTags(tags?: string): string[] {
    if (!tags) return [];
    return tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }
}
