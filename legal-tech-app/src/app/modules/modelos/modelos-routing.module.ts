import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ModelosListComponent } from './pages/modelos-list/modelos-list.component';
import { ModelosFormComponent } from './pages/modelos-form/modelos-form.component';

const routes: Routes = [
  { path: '', component: ModelosListComponent },
  { path: 'nuevo', component: ModelosFormComponent },
  { path: ':id/editar', component: ModelosFormComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ModelosRoutingModule { }
