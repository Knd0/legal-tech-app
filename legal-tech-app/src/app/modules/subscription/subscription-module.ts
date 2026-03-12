import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SubscriptionRoutingModule } from './subscription-routing-module';
import { Success } from './pages/success/success';
import { Pricing } from './pages/pricing/pricing';

@NgModule({
  imports: [
    CommonModule,
    SubscriptionRoutingModule,
    Success,
    Pricing
  ]
})
export class SubscriptionModule { }
