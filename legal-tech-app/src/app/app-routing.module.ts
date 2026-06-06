import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { AdminGuard } from './core/guards/admin.guard';

import { subscriptionGuard } from './core/guards/subscription.guard';

import { Landing } from './pages/landing/landing';

const routes: Routes = [
  { path: '', component: Landing, canActivate: [guestGuard] },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'auth', loadChildren: () => import('./modules/auth/auth-module').then(m => m.AuthModule), canActivate: [guestGuard] },
  { path: 'clientes', loadChildren: () => import('./modules/clientes/clientes.module').then(m => m.ClientesModule), canActivate: [authGuard, subscriptionGuard] },
  { path: 'expedientes', loadChildren: () => import('./modules/expedientes/expedientes.module').then(m => m.ExpedientesModule), canActivate: [authGuard, subscriptionGuard] },
  { path: 'calendario', loadChildren: () => import('./modules/calendario/calendario.module').then(m => m.CalendarioModule), canActivate: [authGuard, subscriptionGuard] },
  { path: 'profile', loadChildren: () => import('./modules/profile/profile.module').then(m => m.ProfileModule), canActivate: [authGuard] },
  { path: 'subscription', loadChildren: () => import('./modules/subscription/subscription-module').then(m => m.SubscriptionModule), canActivate: [authGuard] },
  { path: 'ayuda', loadChildren: () => import('./modules/help/help-module').then(m => m.HelpModule), canActivate: [authGuard] },
  { path: 'admin/users', loadComponent: () => import('./modules/admin/users/admin-users/admin-users').then(m => m.AdminUsers), canActivate: [authGuard, AdminGuard] },
  { path: 'ai', loadChildren: () => import('./modules/ai/ai.module').then(m => m.AiModule), canActivate: [authGuard, subscriptionGuard] },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
