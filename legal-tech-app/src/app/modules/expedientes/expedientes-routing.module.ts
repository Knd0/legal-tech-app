import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ExpedientesListComponent } from './pages/expedientes-list/expedientes-list.component';
import { ExpedientesFormComponent } from './pages/expedientes-form/expedientes-form.component';
import { ExpedienteDetailComponent } from './pages/expediente-detail/expediente-detail.component';
import { KanbanBoard } from './pages/kanban-board/kanban-board';

const routes: Routes = [
  { path: '', component: ExpedientesListComponent },
  { path: 'kanban', component: KanbanBoard },
  { path: 'new', component: ExpedientesFormComponent },
  { path: ':id', component: ExpedienteDetailComponent },
  { path: ':id/edit', component: ExpedientesFormComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ExpedientesRoutingModule { }
