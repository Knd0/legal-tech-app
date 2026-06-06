import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AiRoutingModule } from './ai-routing.module';
import { AiAssistantComponent } from './pages/ai-assistant/ai-assistant.component';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';

@NgModule({
  declarations: [
    AiAssistantComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AiRoutingModule,
    ButtonModule,
    TextareaModule,
    SelectModule,
    TooltipModule
  ]
})
export class AiModule { }
