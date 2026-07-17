import { Component, OnInit, effect, signal, inject } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ExpedienteService } from '../../../../core/services/expediente.service';
import { Expediente, EstadoExpediente } from '../../../../core/models/expediente.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-kanban-board',
  standalone: false,
  templateUrl: './kanban-board.html',
  styleUrl: './kanban-board.css',
})
export class KanbanBoard implements OnInit {

  columns = [
    { id: 'INICIADO' as EstadoExpediente, title: 'Iniciado', color: 'bg-green-500', items: [] as Expediente[] },
    { id: 'PRUEBA' as EstadoExpediente, title: 'Prueba', color: 'bg-blue-500', items: [] as Expediente[] },
    { id: 'ALEGATOS' as EstadoExpediente, title: 'Alegatos', color: 'bg-purple-500', items: [] as Expediente[] },
    { id: 'SENTENCIA' as EstadoExpediente, title: 'Sentencia', color: 'bg-orange-500', items: [] as Expediente[] },
    { id: 'ARCHIVADO' as EstadoExpediente, title: 'Archivado', color: 'bg-gray-500', items: [] as Expediente[] }
  ];

  private dragging = false;
  saving = signal<string | null>(null);

  private expedienteService = inject(ExpedienteService);

  constructor() {
    effect(() => {
      const all = this.expedienteService.expedientes();
      if (!this.dragging) {
        this.distributeExpedientes(all);
      }
    });
  }

  ngOnInit(): void {}

  distributeExpedientes(expedientes: Expediente[]) {
    this.columns.forEach(col => {
      col.items = expedientes.filter(e => e.estado === col.id);
    });
  }

  onDragStarted() {
    this.dragging = true;
  }

  trackByExpedienteId(_: number, item: Expediente): string {
    return item.id;
  }

  drop(event: CdkDragDrop<Expediente[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.dragging = false;
      return;
    }

    // Detectar columna destino por referencia al array (más robusto que event.container.id)
    const targetColumn = this.columns.find(c => c.items === event.container.data);
    if (!targetColumn) {
      this.dragging = false;
      return;
    }

    const item = event.previousContainer.data[event.previousIndex];
    const previousStatus = item.estado;
    const newStatus = targetColumn.id;

    // Actualización optimista
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );
    item.estado = newStatus;
    this.dragging = false;
    this.saving.set(item.id);

    this.expedienteService.updateExpedienteKanban(item.id, newStatus, () => {
      // Rollback si falla
      this.saving.set(null);
      item.estado = previousStatus;
      transferArrayItem(
        event.container.data,
        event.previousContainer.data,
        event.container.data.indexOf(item),
        event.previousIndex,
      );
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo actualizar el estado. Intenta de nuevo.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
      });
    }, () => {
      this.saving.set(null);
    });
  }
}
