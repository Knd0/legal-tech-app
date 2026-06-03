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

  // Fix 2: service ya llama loadExpedientes() en su constructor, no llamar de nuevo
  ngOnInit(): void {}

  distributeExpedientes(expedientes: Expediente[]) {
    this.columns.forEach(col => {
      col.items = expedientes.filter(e => e.estado === col.id);
    });
  }

  drop(event: CdkDragDrop<Expediente[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.isDragging = false;
      return;
    }

    // Fix 3: identificar columna destino por referencia al array, no por event.container.id
    // (event.container.id puede retornar el ID interno de CDK en vez del estado)
    const targetColumn = this.columns.find(c => c.items === event.container.data);
    if (!targetColumn) {
      this.isDragging = false;
      return;
    }

    const item = event.previousContainer.data[event.previousIndex];
    const newStatus = targetColumn.id as Expediente['estado'];

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );

    // Fix 1: isDragging = false DESPUÉS del transferArrayItem pero ANTES de updateExpediente,
    // así el effect que se dispara cuando responde el HTTP ve el estado ya correcto
    item.estado = newStatus;
    this.isDragging = false;
    this.expedienteService.updateExpediente(item.id, { estado: newStatus });
  }

  onDragStarted() {
    this.isDragging = true;
  }

  trackByExpedienteId(_: number, item: Expediente): string {
    return item.id;
  }
}
