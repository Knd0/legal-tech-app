import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PLANS } from './plan-policy';
import { PlanService } from './plan.service';

@Controller('plan')
@UseGuards(JwtAuthGuard)
export class PlanController {
  constructor(private readonly plans: PlanService) {}

  /** Plan, estado, límites y uso actual del estudio: lo que el frontend necesita para mostrar y deshabilitar. */
  @Get()
  async mine(@Request() req) {
    const [access, usage] = await Promise.all([
      this.plans.accessFor(req.user.userId, req.user.role === 'ADMIN'),
      this.plans.usage(req.user.userId),
    ]);
    return { ...access, usage, catalog: PLANS };
  }
}
