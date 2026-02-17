import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { ExpedientesRoutingModule } from './expedientes-routing.module';
import { ExpedientesListComponent } from './pages/expedientes-list/expedientes-list.component';
import { ExpedientesFormComponent } from './pages/expedientes-form/expedientes-form.component';

// PrimeNG Imports
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
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
    ExpedientesRoutingModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    PanelModule,
    DatePickerModule,
    TextareaModule,
    SelectModule,
    TagModule,
    DragDropModule
  ]
})
export class ExpedientesModule { }
