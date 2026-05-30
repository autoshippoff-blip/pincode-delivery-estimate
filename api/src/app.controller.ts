import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';
import { CacheService } from './cache/cache.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly cacheService: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('diagnostics/db-check')
  async dbCheck() {
    try {
      const tenants = await this.prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          apiKey: true,
          isActive: true,
        }
      });
      const maskedTenants = tenants.map(t => ({
        id: t.id,
        name: t.name,
        isActive: t.isActive,
        apiKeyLength: t.apiKey.length,
        apiKeyMasked: t.apiKey.length > 8 ? t.apiKey.substring(0, 4) + '...' + t.apiKey.substring(t.apiKey.length - 4) : '***',
      }));
      return {
        success: true,
        database: 'connected',
        tenantsCount: tenants.length,
        tenants: maskedTenants,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message,
      };
    }
  }

  @Get('diagnostics/cache-stats')
  getCacheStats() {
    if (process.env.NODE_ENV === 'production') {
      return { message: 'Diagnostics disabled in production' };
    }
    return {
      cache: this.cacheService.getStats(),
      process: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
      }
    };
  }

  @Post('diagnostics/cache-flush')
  @HttpCode(HttpStatus.OK)
  flushCache() {
    if (process.env.NODE_ENV === 'production') {
      return { message: 'Diagnostics disabled in production' };
    }
    this.cacheService.flush();
    return { success: true, message: 'Cache flushed successfully' };
  }
}
