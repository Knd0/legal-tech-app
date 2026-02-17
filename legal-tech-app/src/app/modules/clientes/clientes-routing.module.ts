import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientesListComponent } from './pages/clientes-list/clientes-list.component';
import { ClientesFormComponent } from './pages/clientes-form/clientes-form.component';
import { ClientDetailComponent } from './pages/client-detail/client-detail.component';

const routes: Routes = [
  { path: '', component: ClientesListComponent },
  { path: 'new', component: ClientesFormComponent },
  { path: ':id', component: ClientDetailComponent },
  { path: ':id/edit', component: ClientesFormComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientesRoutingModule { }
