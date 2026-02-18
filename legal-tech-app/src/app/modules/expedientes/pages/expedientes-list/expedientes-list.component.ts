import { Component, effect, inject } from '@angular/core';
import { ExpedienteService } from '../../../../core/services/expediente.service';
import { Expediente } from '../../../../core/models/expediente.model';
import { ExcelService } from '../../../../core/services/excel.service';
import { LoadingService } from '../../../../core/services/loading.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-expedientes-list',
  standalone: false,
  templateUrl: './expedientes-list.component.html',
  styleUrl: './expedientes-list.component.scss'
})
export class ExpedientesListComponent {
  expedienteService = inject(ExpedienteService); // Inject first
  expedientes = this.expedienteService.expedientes; // Then use

  excelService = inject(ExcelService);
  loadingService = inject(LoadingService);

  // constructor(public expedienteService: ExpedienteService) {} // Removed constructor injection

  exportList() {
    this.excelService.exportAsExcelFile(this.expedientes(), 'expedientes_lista'); // Unwrap signal
  }

  triggerImport() {
    document.getElementById('importInputExp')?.click();
  }

  async onFileChange(event: any) {
    const target: DataTransfer = <DataTransfer>(event.target);
    if (target.files.length !== 1) return;

    try {
      const data: any[] = await this.excelService.importFromExcel(target.files[0]);
      
      let count = 0;
      for (const row of data) {
         const newExp: Omit<Expediente, 'id'> = {
             nroExpediente: row.nroExpediente || row.NroExpediente || row['Nro. Expediente'] || '',
             caratula: row.caratula || row.Caratula || '',
             fuero: row.fuero || row.Fuero || '',
             juzgado: row.juzgado || row.Juzgado || '',
             estado: row.estado || row.Estado || 'INICIADO',
             descripcion: row.descripcion || row.Descripcion || '',
             fechaInicio: new Date(),
             clienteId: undefined // Import doesn't link clients automatically for now
         };
         
         if(newExp.nroExpediente && newExp.caratula) {
             this.expedienteService.addExpediente(newExp);
             count++;
         }
      }
      
      Swal.fire({
          title: 'Importación Exitosa', 
          text: `Se han importado ${count} expedientes correctamente.`, 
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
      });
      
      event.target.value = '';

    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudo importar el archivo. Verifique el formato.', 'error');
    }
  }

  getSeverity(estado: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | undefined {
    switch (estado) {
      case 'INICIADO': return 'info';
      case 'PRUEBA': return 'warn';
      case 'SENTENCIA': return 'success';
      case 'ARCHIVADO': return 'secondary';
      default: return 'info';
    }
  }
}
