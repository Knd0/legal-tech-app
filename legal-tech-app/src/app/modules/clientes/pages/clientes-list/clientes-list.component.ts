import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../../../core/services/auth.service';
import { SubscriptionService } from '../../../../core/services/subscription.service';
import { ClientService } from '../../../../core/services/client.service';
import { Cliente } from '../../../../core/models/cliente.model';
import { ExcelService } from '../../../../core/services/excel.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { LoadingService } from '../../../../core/services/loading.service';
import Swal from 'sweetalert2';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-clientes-list',
  standalone: false,
  templateUrl: './clientes-list.component.html',
  styleUrl: './clientes-list.component.scss'
})
export class ClientesListComponent implements OnInit, OnDestroy {
  clientService = inject(ClientService);
  excelService = inject(ExcelService);
  notificationService = inject(NotificationService);
  loadingService = inject(LoadingService);
  authService = inject(AuthService);
  subscriptionService = inject(SubscriptionService);

  searchTerm = signal<string>('');
  clientes = signal<Cliente[]>([]);
  totalRecords = signal<number>(0);
  loading = signal<boolean>(false);
  rows = signal<number>(10);
  first = signal<number>(0);
  page = signal<number>(1);

  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  ngOnInit() {
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchTerm.set(term);
      this.page.set(1);
      this.first.set(0);
      this.loadClients();
    });
  }

  ngOnDestroy() {
    this.searchSubscription?.unsubscribe();
  }

  onSearch(event: any) {
    const value = event.target ? event.target.value : event;
    this.searchSubject.next(value);
  }

  loadClients() {
    this.loading.set(true);
    this.clientService.getPaginatedClients(this.page(), this.rows(), this.searchTerm()).subscribe({
      next: (res) => {
        this.clientes.set(res.data);
        this.totalRecords.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load paginated clients', err);
        this.loading.set(false);
      }
    });
  }

  loadClientsLazy(event: any) {
    const pageNum = Math.floor(event.first / event.rows) + 1;
    this.page.set(pageNum);
    this.rows.set(event.rows);
    this.first.set(event.first);
    this.loadClients();
  }

  async sendWhatsapp(cliente: Cliente) {
    if (!cliente.telefono) {
      Swal.fire('Error', 'El cliente no tiene un número de teléfono registrado.', 'error');
      return;
    }

    const { value: text } = await Swal.fire({
      input: 'textarea',
      inputLabel: 'Mensaje para ' + cliente.nombre,
      inputPlaceholder: 'Escribe tu mensaje aquí...',
      inputAttributes: {
        'aria-label': 'Escribe tu mensaje aquí'
      },
      showCancelButton: true,
      confirmButtonText: 'Enviar WhatsApp',
      cancelButtonText: 'Cancelar'
    });

    if (text) {
      this.notificationService.sendWhatsappMessage(cliente.telefono, text);
    }
  }

  async deleteCliente(cliente: Cliente) {
    const result = await Swal.fire({
      title: `¿Eliminar a ${cliente.nombre} ${cliente.apellido}?`,
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      this.loading.set(true);
      this.clientService.deleteClient(cliente.id).subscribe({
        next: () => {
          this.loadClients();
        },
        error: (err) => {
          console.error('Failed to delete client', err);
          this.loading.set(false);
          Swal.fire('Error', 'No se pudo eliminar el cliente.', 'error');
        }
      });
    }
  }

  exportList() {
    this.excelService.exportAsExcelFile(this.clientService.clients(), 'clientes_lista');
  }

  triggerImport() {
    document.getElementById('importInput')?.click();
  }

  async onFileChange(event: any) {
    const target: DataTransfer = <DataTransfer>(event.target);
    if (target.files.length !== 1) return;

    try {
      const data: any[] = await this.excelService.importFromExcel(target.files[0]);
      
      let count = 0;
      for (const row of data) {
         // Mapeo básico: asume que las columnas del Excel coinciden con las claves del modelo o sus nombres capitalizados
         const newClient: Omit<Cliente, 'id'> = {
             nombre: row.nombre || row.Nombre || '',
             apellido: row.apellido || row.Apellido || '',
             dni: row.dni || row.DNI || '',
             email: row.email || row.Email || '',
             telefono: row.telefono || row.Telefono || '',
             domicilio: row.domicilio || row.Domicilio || '',
             fechaAlta: new Date(),
             grupoFamiliar: []
         };
         
         // Validación mínima
         if(newClient.nombre && newClient.apellido) {
             this.clientService.addClient(newClient);
             count++;
         }
      }
      
      Swal.fire({
          title: 'Importación Exitosa', 
          text: `Se han importado ${count} clientes correctamente.`, 
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
      });
      
      // Reset input
      event.target.value = '';

    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudo importar el archivo. Verifique el formato.', 'error');
    }
  }
}
