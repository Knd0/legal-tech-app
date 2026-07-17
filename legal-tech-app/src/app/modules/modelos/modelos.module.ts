import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { ModelosRoutingModule } from './modelos-routing.module';
import { ModelosListComponent } from './pages/modelos-list/modelos-list.component';
import { ModelosFormComponent } from './pages/modelos-form/modelos-form.component';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TextareaModule } from 'primeng/textarea';
import { PaginatorModule } from 'primeng/paginator';

@NgModule({
  declarations: [
    ModelosListComponent,
    ModelosFormComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ModelosRoutingModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TagModule,
    TooltipModule,
    TextareaModule,
    PaginatorModule
  ]
})
export class ModelosModule { }
