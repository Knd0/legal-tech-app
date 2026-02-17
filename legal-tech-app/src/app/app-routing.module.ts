import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

const routes: Routes = [
  { path: '', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'auth', loadChildren: () => import('./modules/auth/auth-module').then(m => m.AuthModule), canActivate: [guestGuard] },
  { path: 'clientes', loadChildren: () => import('./modules/clientes/clientes.module').then(m => m.ClientesModule), canActivate: [authGuard] },
  { path: 'expedientes', loadChildren: () => import('./modules/expedientes/expedientes.module').then(m => m.ExpedientesModule), canActivate: [authGuard] },
  { path: 'calendario', loadChildren: () => import('./modules/calendario/calendario.module').then(m => m.CalendarioModule), canActivate: [authGuard] },
  { path: 'profile', loadChildren: () => import('./modules/profile/profile.module').then(m => m.ProfileModule), canActivate: [authGuard] },
  { path: 'ayuda', loadChildren: () => import('./modules/help/help-module').then(m => m.HelpModule), canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
