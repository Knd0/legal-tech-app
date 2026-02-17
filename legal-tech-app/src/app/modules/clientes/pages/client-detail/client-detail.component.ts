import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ClientService } from '../../../../core/services/client.service';
import { ExcelService } from '../../../../core/services/excel.service';
import { ExpedienteService } from '../../../../core/services/expediente.service';
import { Cliente } from '../../../../core/models/cliente.model';
import { Expediente } from '../../../../core/models/expediente.model';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { PanelModule } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { CuentaCorrienteComponent } from '../../components/cuenta-corriente/cuenta-corriente.component';
import { DocumentsListComponent } from '../../../../shared/components/documents-list/documents-list.component';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, CardModule, TagModule, DividerModule, PanelModule, TableModule, TooltipModule, CuentaCorrienteComponent, DocumentsListComponent],
  templateUrl: './client-detail.component.html',
  styles: []
})
export class ClientDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private clientService = inject(ClientService);
  private expedienteService = inject(ExpedienteService);
  private excelService = inject(ExcelService);

  client = signal<Cliente | undefined>(undefined);
  expedientes = signal<Expediente[]>([]);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const foundClient = this.clientService.getClientById(id);
      if (foundClient) {
        this.client.set(foundClient);
        this.expedientes.set(this.expedienteService.getExpedientesByClientId(id));
      } else {
        // Handle not found
        this.router.navigate(['/clientes']);
      }
    }
  }

  openMap(address: string) {
    if (address) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
      window.open(url, '_blank');
    }
  }

  exportToExcel() {
    const c = this.client();
    if (c) {
      const dataToExport = {
        ...c,
        grupoFamiliar: c.grupoFamiliar ? JSON.stringify(c.grupoFamiliar) : 'N/A',
        expedientes: this.expedientes().map(e => e.caratula).join(' | ')
      };
      this.excelService.exportDetailedData(dataToExport, `Cliente_${c.apellido}_${c.nombre}`);
    }
  }

  goBack() {
    this.router.navigate(['/clientes']);
  }
}
