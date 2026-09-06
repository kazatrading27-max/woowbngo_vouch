import 'dotenv/config';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';

export async function createApp(adapter?: ExpressAdapter): Promise<INestApplication> {
  const app = adapter
    ? await NestFactory.create(AppModule, adapter, { logger: ['error', 'warn'] })
    : await NestFactory.create(AppModule, { logger: ['error', 'warn'] });

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const origins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (origins.length === 0 && process.env.NODE_ENV === 'production') {
    throw new Error('CORS_ORIGIN environment variable is required in production');
  }
  app.enableCors({ origin: origins.length > 0 ? origins : true, credentials: false });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  return app;
}
