import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { ExpedienteService } from '../../../../core/services/expediente.service';
import { Expediente } from '../../../../core/models/expediente.model';
import { ExcelService } from '../../../../core/services/excel.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { AuthService } from '../../../../core/services/auth.service';
import Swal from 'sweetalert2';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-expedientes-list',
  standalone: false,
  templateUrl: './expedientes-list.component.html',
  styleUrl: './expedientes-list.component.scss',
})
export class ExpedientesListComponent implements OnInit, OnDestroy {
  authService = inject(AuthService);
  expedienteService = inject(ExpedienteService);
  excelService = inject(ExcelService);
  loadingService = inject(LoadingService);

  searchTerm = signal<string>('');
  filterEstado = signal<string>('');

  expedientes = signal<Expediente[]>([]);
  totalRecords = signal<number>(0);
  loading = signal<boolean>(false);
  rows = signal<number>(10);
  first = signal<number>(0);
  page = signal<number>(1);

  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  estadoOptions = [
    { label: 'Todos', value: '' },
    { label: 'Iniciado', value: 'INICIADO' },
    { label: 'Prueba', value: 'PRUEBA' },
    { label: 'Alegatos', value: 'ALEGATOS' },
    { label: 'Sentencia', value: 'SENTENCIA' },
    { label: 'Archivado', value: 'ARCHIVADO' },
  ];

  ngOnInit() {
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchTerm.set(term);
      this.page.set(1);
      this.first.set(0);
      this.loadExpedientes();
    });
  }

  ngOnDestroy() {
    this.searchSubscription?.unsubscribe();
  }

  onSearch(event: any) {
    const value = event.target ? event.target.value : event;
    this.searchSubject.next(value);
  }

  onEstadoChange(estado: string) {
    this.filterEstado.set(estado);
    this.page.set(1);
    this.first.set(0);
    this.loadExpedientes();
  }

  loadExpedientes() {
    this.loading.set(true);
    this.expedienteService.getPaginatedExpedientes(
      this.page(),
      this.rows(),
      this.searchTerm(),
      this.filterEstado()
    ).subscribe({
      next: (res) => {
        this.expedientes.set(res.data);
        this.totalRecords.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load paginated expedientes', err);
        this.loading.set(false);
      }
    });
  }

  loadExpedientesLazy(event: any) {
    const pageNum = Math.floor(event.first / event.rows) + 1;
    this.page.set(pageNum);
    this.rows.set(event.rows);
    this.first.set(event.first);
    this.loadExpedientes();
  }

  async deleteExpediente(expediente: Expediente) {
    const result = await Swal.fire({
      title: `¿Eliminar expediente ${expediente.nroExpediente}?`,
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      this.loading.set(true);
      this.expedienteService.deleteExpediente(expediente.id).subscribe({
        next: () => {
          this.loadExpedientes();
        },
        error: (err) => {
          console.error('Failed to delete expediente', err);
          this.loading.set(false);
          Swal.fire('Error', 'No se pudo eliminar el expediente.', 'error');
        }
      });
    }
  }

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
