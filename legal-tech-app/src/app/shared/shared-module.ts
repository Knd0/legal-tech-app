import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { GavelLoader } from './components/gavel-loader';

@NgModule({
  declarations: [
    GavelLoader
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule
  ],
  exports: []
})
export class SharedModule { }
