import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CalendarioViewComponent } from './pages/calendario-view/calendario-view.component';

const routes: Routes = [
  { path: '', component: CalendarioViewComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CalendarioRoutingModule { }
