import { Component, OnInit, signal, effect } from '@angular/core';
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

  // Define columns based on EtapaProcesal
  columns = [
    { id: 'INICIADO', title: 'Iniciado', items: signal<Expediente[]>([]) },
    { id: 'PRUEBA', title: 'Prueba', items: signal<Expediente[]>([]) },
    { id: 'ALEGATOS', title: 'Alegatos', items: signal<Expediente[]>([]) },
    { id: 'SENTENCIA', title: 'Sentencia', items: signal<Expediente[]>([]) },
    { id: 'ARCHIVADO', title: 'Archivado', items: signal<Expediente[]>([]) }
  ];

  constructor(private expedienteService: ExpedienteService) {
      // React to changes in the service state
      effect(() => {
          const allExpedientes = this.expedienteService.expedientes();
          this.distributeExpedientes(allExpedientes);
      });
  }

  ngOnInit(): void {
      this.expedienteService.loadExpedientes();
  }

  distributeExpedientes(expedientes: Expediente[]) {
      this.columns.forEach(col => {
          // Filter expedientes that match the column ID (state)
          // Default to 'INICIADO' if state is missing or doesn't match known columns? 
          // For now, strict match.
          const filtered = expedientes.filter(e => e.estado === col.id);
          col.items.set(filtered);
      });
  }

  drop(event: CdkDragDrop<Expediente[]>) {
    if (event.previousContainer === event.container) {
      // Reorder within the same column
      const currentItems = [...event.container.data]; // Copy for mutability
      moveItemInArray(currentItems, event.previousIndex, event.currentIndex);
      
      // Update signal manually for UI feedback if strict
      // In this setup, event.container.data comes from the template binding [cdkDropListData]="col.items()"
      // But signals are read-only views often. 
      // We need to find the column and update its signal.
      const colId = event.container.id;
      const column = this.columns.find(c => c.id === colId);
      if(column) {
          column.items.set(currentItems);
      }

    } else {
      // Move to another column
      const previousItems = [...event.previousContainer.data];
      const currentItems = [...event.container.data];
      
      const item = previousItems[event.previousIndex];
      const newStatus = event.container.id as any; // Cast to any to avoid strict type error, or import EstadoExpediente

      transferArrayItem(
        previousItems,
        currentItems,
        event.previousIndex,
        event.currentIndex,
      );

       // Update UI immediately
       const prevCol = this.columns.find(c => c.id === event.previousContainer.id);
       const currCol = this.columns.find(c => c.id === event.container.id);
       
       if(prevCol) prevCol.items.set(previousItems);
       if(currCol) currCol.items.set(currentItems);

      // Update Backend
      this.expedienteService.updateExpediente(item.id, { estado: newStatus });
    }
  }
}
