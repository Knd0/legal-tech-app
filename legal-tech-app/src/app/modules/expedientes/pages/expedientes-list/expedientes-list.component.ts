import { Component, inject, signal, computed } from '@angular/core';
import { ExpedienteService } from '../../../../core/services/expediente.service';
import { Expediente } from '../../../../core/models/expediente.model';
import { ExcelService } from '../../../../core/services/excel.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { AuthService } from '../../../../core/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-expedientes-list',
  standalone: false,
  templateUrl: './expedientes-list.component.html',
  styleUrl: './expedientes-list.component.scss',
})
export class ExpedientesListComponent {
  authService = inject(AuthService);
  expedienteService = inject(ExpedienteService);
  excelService = inject(ExcelService);
  loadingService = inject(LoadingService);

  searchTerm = signal<string>('');
  filterEstado = signal<string>('');

  estadoOptions = [
    { label: 'Todos', value: '' },
    { label: 'Iniciado', value: 'INICIADO' },
    { label: 'Prueba', value: 'PRUEBA' },
    { label: 'Alegatos', value: 'ALEGATOS' },
    { label: 'Sentencia', value: 'SENTENCIA' },
    { label: 'Archivado', value: 'ARCHIVADO' },
  ];

  expedientes = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const estado = this.filterEstado();
    return this.expedienteService.expedientes().filter(e => {
      const matchesSearch = !term ||
        e.nroExpediente?.toLowerCase().includes(term) ||
        e.caratula?.toLowerCase().includes(term) ||
        e.fuero?.toLowerCase().includes(term) ||
        e.juzgado?.toLowerCase().includes(term);
      const matchesEstado = !estado || e.estado === estado;
      return matchesSearch && matchesEstado;
    });
  });

  exportList() {
    this.excelService.exportAsExcelFile(this.expedienteService.expedientes(), 'expedientes_lista');
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
