import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { GavelLoaderComponent } from './components/gavel-loader';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    GavelLoaderComponent
  ],
  exports: [
    GavelLoaderComponent,
    CommonModule,
    ReactiveFormsModule,
    FormsModule
  ]
})
export class SharedModule { }
