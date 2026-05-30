import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { APP_GUARD } from '@nestjs/core';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { configSchema } from './config/config.schema';
import { CacheModule } from './cache/cache.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { PincodeModule } from './modules/pincode/pincode.module';
import { EtaModule } from './modules/eta/eta.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    // Global Config module with Zod validation
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        const parsed = configSchema.safeParse(config);
        if (!parsed.success) {
          console.error('❌ Invalid environment configuration:', parsed.error.format());
          throw new Error('Invalid environment configuration');
        }
        return parsed.data;
      },
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'apiKey',
          ttl: config.get<number>('THROTTLE_TTL', 60) * 1000, // convert to ms
          limit: config.get<number>('THROTTLE_LIMIT', 60),
        },
        {
          name: 'ip',
          ttl: config.get<number>('THROTTLE_TTL', 60) * 1000, // convert to ms
          limit: config.get<number>('THROTTLE_LIMIT_IP', 100),
        },
      ],
    }),

    // Structured Pino Logger
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
        // Don't log sensitive HTTP headers
        redact: ['req.headers.authorization', 'req.headers["x-api-key"]'],
      },
    }),

    PrismaModule,
    HealthModule,
    CacheModule,
    AnalyticsModule,
    TenantModule,
    PincodeModule,
    EtaModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
