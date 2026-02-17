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

import { DocumentsListComponent } from '../../../../shared/components/documents-list/documents-list.component';

@Component({
  selector: 'app-expediente-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, CardModule, TagModule, DividerModule, PanelModule, DocumentsListComponent],
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

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const found = this.expedienteService.getExpedienteById(id);
      if (found) {
        this.expediente.set(found);
        if (found.clienteId) {
            const client = this.clientService.getClientById(found.clienteId);
            if (client) {
                this.clientName.set(`${client.apellido}, ${client.nombre}`);
                // Optionally attach client object to expediente signal if needed, or just store name
                found.cliente = client; // Since Interface allows it
            }
        }
      } else {
        this.router.navigate(['/expedientes']);
      }
    }
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
}
