import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PlanAccessInterceptor } from './plan-access.interceptor';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';

@Global()
@Module({
  controllers: [PlanController],
  providers: [PlanService, { provide: APP_INTERCEPTOR, useClass: PlanAccessInterceptor }],
  exports: [PlanService],
})
export class PlanModule {}
