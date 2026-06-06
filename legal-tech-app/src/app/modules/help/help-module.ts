import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { HelpRoutingModule } from './help-routing-module';
import { Help } from './help';


@NgModule({
  declarations: [
    Help
  ],
  imports: [
    CommonModule,
    FormsModule,
    HelpRoutingModule
  ]
})
export class HelpModule { }
