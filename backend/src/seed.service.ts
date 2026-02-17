import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { UsersService } from './users/users.service';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly usersService: UsersService) {}

  async onApplicationBootstrap() {
    this.logger.log('Checking for default Admin user...');
    
    const adminEmail = 'admin@legaltech.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    
    if (!process.env.ADMIN_PASSWORD) {
        this.logger.warn('WARNING: Using default admin password. Set ADMIN_PASSWORD environment variable in production!');
    }

    const existingUser = await this.usersService.findOneByEmail(adminEmail);

    if (!existingUser) {
      this.logger.log('Creating default Admin user...');
      await this.usersService.createUser({
        email: adminEmail,
        password: adminPassword,
        fullName: 'Administrator',
        role: 'ADMIN',
        isActive: true
      });
      this.logger.log(`Admin created: ${adminEmail} (Password: ${process.env.ADMIN_PASSWORD ? 'HIDDEN' : adminPassword})`);
    } else {
      this.logger.log('Admin user already exists.');
    }
  }
}
