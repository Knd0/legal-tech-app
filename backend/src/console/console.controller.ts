import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ConsoleKeyGuard } from './console-key.guard';
import { ConsoleService } from './console.service';

/**
 * API interna para la consola central. No la usa el frontend de Themis.
 * Ver console-key.guard.ts para la autenticación.
 */
@Controller('internal/console')
@UseGuards(ConsoleKeyGuard)
@SkipThrottle()
export class ConsoleController {
  constructor(private readonly consoleService: ConsoleService) {}

  @Get('summary')
  summary() {
    return this.consoleService.summary();
  }

  @Post('tenants/:id/suspend')
  @HttpCode(200)
  suspend(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.consoleService.setSuspended(id, true);
  }

  @Post('tenants/:id/reactivate')
  @HttpCode(200)
  reactivate(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.consoleService.setSuspended(id, false);
  }
}
