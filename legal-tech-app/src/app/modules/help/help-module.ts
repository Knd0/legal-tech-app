import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

import { HelpRoutingModule } from './help-routing-module';
import { Help } from './help';


@NgModule({
  declarations: [
    Help
  ],
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    HelpRoutingModule
  ]
})
export class HelpModule { }
