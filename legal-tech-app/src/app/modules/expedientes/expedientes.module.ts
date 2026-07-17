import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { ExpedientesRoutingModule } from './expedientes-routing.module';
import { ExpedientesListComponent } from './pages/expedientes-list/expedientes-list.component';
import { ExpedientesFormComponent } from './pages/expedientes-form/expedientes-form.component';
import { GavelLoaderComponent } from '../../shared/components/gavel-loader';

// PrimeNG Imports
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { KanbanBoard } from './pages/kanban-board/kanban-board';

@NgModule({
  declarations: [
    ExpedientesListComponent,
    ExpedientesFormComponent,
    KanbanBoard
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ExpedientesRoutingModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    PanelModule,
    DatePickerModule,
    TextareaModule,
    SelectModule,
    TagModule,
    TooltipModule,
    ToggleSwitchModule,
    DragDropModule,
    GavelLoaderComponent
  ]
})
export class ExpedientesModule { }
