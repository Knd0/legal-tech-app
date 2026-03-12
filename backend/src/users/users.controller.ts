import { Controller, Get, UseGuards, Req, Patch, Body, Post, Param, Delete } from '@nestjs/common';
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
    // Sanitize password
    if (user) {
        const { passwordHash, ...result } = user;
        return result;
    }
    return null;
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Req() req, @Body() updateData: any) {
    return this.usersService.updateProfile(req.user.userId, updateData);
  }

  // --- Admin Endpoints (Dynamic IDs) ---

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map(u => {
      const { passwordHash, ...result } = u;
      return result;
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(@Body() createUserDto: any) {
      const user = await this.usersService.createUser(createUserDto);
      const { passwordHash, ...result } = user;
      return result;
  }

  @Get('test')
  getTest() {
    return 'Users Controller is working';
  }

  @Patch(':id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async toggleStatus(@Param('id') id: string) {
      return this.usersService.toggleStatus(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() updateData: any) {
      const user = await this.usersService.updateUser(id, updateData);
      const { passwordHash, ...result } = user;
      return result;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async remove(@Param('id') id: string) {
      return this.usersService.deleteUser(id);
  }
}
