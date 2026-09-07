import * as crypto from 'crypto';
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = crypto;
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Global] Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[Global] Uncaught Exception thrown:', err);
  });

  const app = await NestFactory.create(AppModule);

  // Security headers. La API sólo devuelve JSON y streams de archivos, por lo que
  // no necesita CSP de documento; se desactiva para no romper el streaming de
  // documentos ni los PDFs de facturas servidos inline.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Validación global. Sólo actúa sobre handlers cuyo @Body() está tipado con una
  // clase DTO decorada: los endpoints sin DTO pasan sin cambios, lo que permite
  // adoptar DTOs de forma incremental.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length
      ? allowedOrigins
      : ['https://legal-tech-app-woad.vercel.app', 'http://localhost:4200'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
