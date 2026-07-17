import * as crypto from 'crypto';
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = crypto;
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Global] Unhandled Rejection at:', promise, 'reason:', reason);
  });
  
  process.on('uncaughtException', (err) => {
    console.error('[Global] Uncaught Exception thrown:', err);
  });

  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['https://legal-tech-app-woad.vercel.app', 'http://localhost:4200'], 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
