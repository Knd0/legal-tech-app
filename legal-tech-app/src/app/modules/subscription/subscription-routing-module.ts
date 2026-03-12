import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { Pricing } from './pages/pricing/pricing';

import { Success } from './pages/success/success';

const routes: Routes = [
  { path: 'pricing', component: Pricing },
  { path: 'success', component: Success },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SubscriptionRoutingModule { }
