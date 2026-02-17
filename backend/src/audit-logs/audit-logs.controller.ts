import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('audit-logs')
@UseGuards(AuthGuard('jwt'))
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  findAll(@Request() req) {
    return this.auditLogsService.findAll(req.user.userId);
  }

  @Get('recent')
  findRecent(@Request() req) {
    return this.auditLogsService.findRecent(req.user.userId);
  }
}
