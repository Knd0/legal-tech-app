import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ExpedienteService } from '../../../../core/services/expediente.service';
import { ExcelService } from '../../../../core/services/excel.service';
import { ClientService } from '../../../../core/services/client.service';
import { Expediente } from '../../../../core/models/expediente.model';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { PanelModule } from 'primeng/panel';
import { TimelineModule } from 'primeng/timeline';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { DocumentsListComponent } from '../../../../shared/components/documents-list/documents-list.component';

@Component({
  selector: 'app-expediente-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ButtonModule,
    CardModule,
    TagModule,
    DividerModule,
    PanelModule,
    TimelineModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    DatePickerModule,
    FormsModule,
    DocumentsListComponent
  ],
  templateUrl: './expediente-detail.component.html',
  styles: []
})
export class ExpedienteDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private expedienteService = inject(ExpedienteService);
  private clientService = inject(ClientService);
  private excelService = inject(ExcelService);

  expediente = signal<Expediente | undefined>(undefined);
  clientName = signal<string>('');
  actuaciones = signal<any[]>([]);
  syncing = signal(false);
  showAddActuacionDialog = signal(false);

  newActuacion = {
    fecha: new Date(),
    titulo: '',
    descripcion: '',
    foja: ''
  };

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const found = this.expedienteService.getExpedienteById(id);
      if (found) {
        this.expediente.set(found);
        this.setupClientName(found);
        this.loadActuaciones(id);
      } else {
        this.expedienteService.getExpedienteByIdHttp(id).subscribe({
          next: (exp) => {
            if (exp) {
              this.expediente.set(exp);
              this.setupClientName(exp);
              this.loadActuaciones(id);
            } else {
              this.router.navigate(['/expedientes']);
            }
          },
          error: () => {
            this.router.navigate(['/expedientes']);
          }
        });
      }
    }
  }

  setupClientName(found: Expediente) {
    if (found.clienteId) {
        const client = this.clientService.getClientById(found.clienteId);
        if (client) {
            this.clientName.set(`${client.apellido}, ${client.nombre}`);
            found.cliente = client;
        } else {
            this.clientService.getClientByIdHttp(found.clienteId).subscribe({
                next: (c) => {
                    if (c) {
                        this.clientName.set(`${c.apellido}, ${c.nombre}`);
                        found.cliente = c;
                        this.expediente.set({ ...found, cliente: c });
                    }
                }
            });
        }
    }
  }

  loadActuaciones(id: string) {
    this.expedienteService.getActuaciones(id).subscribe({
      next: (data) => this.actuaciones.set(data),
      error: (err) => console.error('Error al cargar actuaciones:', err)
    });
  }

  exportToExcel() {
    const e = this.expediente();
    if (e) {
      // Create export object with client name
      const exportData = {
          ...e,
          cliente: this.clientName() || e.clienteId
      };
      this.excelService.exportDetailedData(exportData, `Expediente_${e.nroExpediente.replace(/\//g,'-')}`);
    }
  }

  goBack() {
    this.router.navigate(['/expedientes']);
  }

  getSeverity(estado: string): "success" | "info" | "warn" | "danger" | "secondary" | "contrast" | undefined {
    switch (estado) {
      case 'INICIADO': return 'info';
      case 'PRUEBA': return 'warn';
      case 'ALEGATOS': return 'warn';
      case 'SENTENCIA': return 'success';
      case 'ARCHIVADO': return 'secondary';
      default: return 'info';
    }
  }

  triggerSync() {
    const e = this.expediente();
    if (!e) return;
    this.syncing.set(true);

    this.expedienteService.sync(e.id).subscribe({
      next: (res) => {
        this.syncing.set(false);
        Swal.fire({
          icon: 'success',
          title: 'Sincronización Exitosa',
          text: res.added > 0 
            ? `Se encontraron y guardaron ${res.added} nuevas actuaciones.`
            : 'No se encontraron nuevos movimientos procesales.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 4000
        });
        this.loadActuaciones(e.id);
      },
      error: (err) => {
        this.syncing.set(false);
        console.error(err);
        Swal.fire({
          icon: 'error',
          title: 'Error de Sincronización',
          text: 'No se pudo conectar con el portal de consultas o las credenciales son inválidas.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 4000
        });
      }
    });
  }

  addManualActuacion() {
    const e = this.expediente();
    if (!e) return;

    if (!this.newActuacion.titulo || !this.newActuacion.descripcion) {
      Swal.fire('Campos requeridos', 'Por favor complete título y descripción.', 'warning');
      return;
    }

    this.expedienteService.createActuacion(e.id, this.newActuacion).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Guardado',
          text: 'La actuación se ha agregado de forma manual.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
        this.showAddActuacionDialog.set(false);
        this.newActuacion = {
          fecha: new Date(),
          titulo: '',
          descripcion: '',
          foja: ''
        };
        this.loadActuaciones(e.id);
      },
      error: (err) => {
        console.error(err);
        Swal.fire('Error', 'No se pudo registrar la actuación manual.', 'error');
      }
    });
  }

  deleteActuacion(actuacionId: string) {
    const e = this.expediente();
    if (!e) return;

    Swal.fire({
      title: '¿Eliminar actuación?',
      text: 'Se eliminará de la cronología de este expediente.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--accent-terracotta)',
      cancelButtonColor: '#aaa',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.expedienteService.deleteActuacion(e.id, actuacionId).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Eliminado',
              text: 'La actuación ha sido eliminada con éxito.',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3000
            });
            this.loadActuaciones(e.id);
          },
          error: (err) => {
            console.error(err);
            Swal.fire('Error', 'No se pudo eliminar la actuación.', 'error');
          }
        });
      }
    });
  }
}
