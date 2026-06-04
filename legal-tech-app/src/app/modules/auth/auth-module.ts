import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';

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
    RouterModule,
    AuthRoutingModule,
    ReactiveFormsModule,
    InputTextModule,
    InputGroupModule,
    InputGroupAddonModule
  ]
})
export class AuthModule { }
