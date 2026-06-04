import { Component, OnInit, effect } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ExpedienteService } from '../../../../core/services/expediente.service';
import { Expediente } from '../../../../core/models/expediente.model';

@Component({
  selector: 'app-kanban-board',
  standalone: false,
  templateUrl: './kanban-board.html',
  styleUrl: './kanban-board.css',
})
export class KanbanBoard implements OnInit {

  columns = [
    { id: 'INICIADO', title: 'Iniciado', items: [] as Expediente[] },
    { id: 'PRUEBA', title: 'Prueba', items: [] as Expediente[] },
    { id: 'ALEGATOS', title: 'Alegatos', items: [] as Expediente[] },
    { id: 'SENTENCIA', title: 'Sentencia', items: [] as Expediente[] },
    { id: 'ARCHIVADO', title: 'Archivado', items: [] as Expediente[] }
  ];

  private isDragging = false;

  constructor(private expedienteService: ExpedienteService) {
    effect(() => {
      const allExpedientes = this.expedienteService.expedientes();
      if (!this.isDragging) {
        this.distributeExpedientes(allExpedientes);
      }
    });
  }

  ngOnInit(): void {
    this.expedienteService.loadExpedientes();
  }

  distributeExpedientes(expedientes: Expediente[]) {
    this.columns.forEach(col => {
      col.items = expedientes.filter(e => e.estado === col.id);
    });
  }

  drop(event: CdkDragDrop<Expediente[]>) {
    this.isDragging = false;

    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const item = event.previousContainer.data[event.previousIndex];
      const newStatus = event.container.id as Expediente['estado'];

      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );

      item.estado = newStatus;
      this.expedienteService.updateExpediente(item.id, { estado: newStatus });
    }
  }

  onDragStarted() {
    this.isDragging = true;
  }
}
