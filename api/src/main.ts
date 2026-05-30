import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { ZodValidationPipe } from 'nestjs-zod';
import * as express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // Disable body parsing inside NestFactory.create if we need custom body parsing,
  // otherwise default express parser is fine.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use pino logger as global logger
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Load configuration service
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // Security headers using Helmet (CSP disabled to allow inline scripts and CDN assets)
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  // Dynamic CORS configuration (configured per tenant allowedOrigins in Phase 2/3)
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // In development or when origin is not sent (e.g. server-to-server or mobile app),
      // we allow it. Otherwise, we will validate it against allowed origins in future phases.
      if (!origin || process.env.NODE_ENV !== 'production') {
        callback(null, true);
        return;
      }
      // For V1 default, we allow the origin, but we will lock it down in Phase 3.
      callback(null, true);
    },
    methods: 'GET,POST',
    allowedHeaders: 'Content-Type,Accept,X-API-Key,x-api-key',
    credentials: true,
  });

  // Global validation pipe using nestjs-zod
  app.useGlobalPipes(new ZodValidationPipe());

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Dynamic workspace root resolution based on whether tsc (dist/src) or webpack (dist) is used
  const isTscDir = __dirname.includes('dist/src') || __dirname.includes('dist\\src');
  const workspaceRoot = isTscDir ? join(__dirname, '..', '..', '..') : join(__dirname, '..', '..');

  // Serve widget files statically (for testing/demo purposes)
  app.use('/widget', express.static(join(workspaceRoot, 'widget')));

  // Serve onboarding and dashboard UIs statically
  app.use('/onboarding', express.static(join(workspaceRoot, 'public', 'onboarding')));
  app.use('/dashboard', express.static(join(workspaceRoot, 'public', 'dashboard')));

  // Start the server
  await app.listen(port);
  logger.log(`🚀 Delivery ETA SaaS Backend running on http://localhost:${port}`);
}

bootstrap().catch((err: unknown) => {
  console.error('❌ Error during application startup:', err);
  process.exit(1);
});
