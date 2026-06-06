import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const logger = new Logger('SeedAdmin');

  const adminEmail = 'admin@themis.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!'; 
  if (!process.env.ADMIN_PASSWORD) {
      logger.warn('WARNING: Using default admin password. Set ADMIN_PASSWORD environment variable in production!');
  }

  logger.log('Checking for existing admin...');
  const existingUser = await usersService.findOneByEmail(adminEmail);

  if (!existingUser) {
    logger.log('Creating default Admin user...');
    await usersService.createUser({
      email: adminEmail,
      password: adminPassword,
      fullName: 'Administrator',
      role: 'ADMIN',
      isActive: true
    });
    logger.log(`Admin created: ${adminEmail} / ${adminPassword}`);
  } else {
    logger.log('Admin user already exists.');
    if (existingUser.role !== 'ADMIN') {
        logger.log('Promoting user to ADMIN...');
        // Not implemented in service but good to know
    }
  }

  await app.close();
}
bootstrap();
