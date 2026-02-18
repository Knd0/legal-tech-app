import { Component, effect, inject } from '@angular/core';
import { ClientService } from '../../../../core/services/client.service';
import { Cliente } from '../../../../core/models/cliente.model';
import { ExcelService } from '../../../../core/services/excel.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { LoadingService } from '../../../../core/services/loading.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-clientes-list',
  standalone: false,
  templateUrl: './clientes-list.component.html',
  styleUrl: './clientes-list.component.scss'
})
export class ClientesListComponent {
  clientService = inject(ClientService); // Inject first
  clientes = this.clientService.clients; // Then use

  excelService = inject(ExcelService);
  notificationService = inject(NotificationService);
  loadingService = inject(LoadingService);

  // constructor(public clientService: ClientService) {} // Removed constructor injection

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

  exportList() {
    this.excelService.exportAsExcelFile(this.clientes(), 'clientes_lista'); // Unwrap signal
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
