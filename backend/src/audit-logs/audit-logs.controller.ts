import { Controller, Get, Request, UseGuards, Query } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('audit-logs')
@UseGuards(AuthGuard('jwt'))
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  findAll(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.auditLogsService.findAll(req.user.userId, pageNum, limitNum);
  }

  @Get('recent')
  findRecent(@Request() req) {
    return this.auditLogsService.findRecent(req.user.userId);
  }
}
