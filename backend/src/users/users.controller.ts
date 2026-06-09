import { Controller, Get, UseGuards, Req, Patch, Body, Post, Param, Delete, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // --- User Profile (MUST BE BEFORE :id routes) ---

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req) {
    const user = await this.usersService.findOneById(req.user.userId);
    return this.sanitizeAndFlattenUser(user);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Req() req, @Body() updateData: any) {
    const user = await this.usersService.updateProfile(req.user.userId, updateData);
    return this.sanitizeAndFlattenUser(user);
  }

  // --- Admin Endpoints (Dynamic IDs) ---

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    if (page || limit) {
      const result = await this.usersService.findAllPaginated(
        page ? +page : 1,
        limit ? +limit : 10,
        search,
        status,
      );
      return {
        ...result,
        data: result.data.map(u => this.sanitizeAndFlattenUser(u)),
      };
    }
    const users = await this.usersService.findAll();
    return users.map(u => this.sanitizeAndFlattenUser(u));
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(@Body() createUserDto: any) {
      const user = await this.usersService.createUser(createUserDto);
      return this.sanitizeAndFlattenUser(user);
  }

  @Get('test')
  getTest() {
    return 'Users Controller is working';
  }

  @Patch(':id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async toggleStatus(@Param('id') id: string) {
      const user = await this.usersService.toggleStatus(id);
      return this.sanitizeAndFlattenUser(user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() updateData: any) {
      const user = await this.usersService.updateUser(id, updateData);
      return this.sanitizeAndFlattenUser(user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async remove(@Param('id') id: string) {
      return this.usersService.deleteUser(id);
  }

  private sanitizeAndFlattenUser(user: any): any {
    if (!user) return null;
    const { passwordHash, subscription, ...rest } = user;
    return {
      ...rest,
      subscriptionStatus: subscription?.subscriptionStatus || 'trial',
      subscriptionExpiresAt: subscription?.subscriptionExpiresAt || null,
      mpSubscriptionId: subscription?.mpSubscriptionId || null,
      subscriptionPlan: subscription?.subscriptionPlan || 'pro',
    };
  }
}
