import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { ClientesRoutingModule } from './clientes-routing.module';
import { ClientesListComponent } from './pages/clientes-list/clientes-list.component';
import { ClientesFormComponent } from './pages/clientes-form/clientes-form.component';
import { GavelLoaderComponent } from '../../shared/components/gavel-loader';

// PrimeNG Imports
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';

@NgModule({
  declarations: [
    ClientesListComponent,
    ClientesFormComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ClientesRoutingModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    PanelModule,
    DatePickerModule,
    TextareaModule,
    CheckboxModule,
    TooltipModule,
    GavelLoaderComponent
  ]
})
export class ClientesModule { }
