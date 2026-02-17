import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';

import { AuthRoutingModule } from './auth-routing-module';
import { Auth } from './auth';
import { LoginComponent } from './pages/login/login';

@NgModule({
  declarations: [
    Auth,
    LoginComponent
  ],
  imports: [
    CommonModule,
    AuthRoutingModule,
    ReactiveFormsModule,
    InputTextModule
  ]
})
export class AuthModule { }
