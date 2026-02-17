import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Help } from './help';

const routes: Routes = [{ path: '', component: Help }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HelpRoutingModule { }
