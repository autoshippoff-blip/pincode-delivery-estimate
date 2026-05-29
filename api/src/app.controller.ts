import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';
import { CacheService } from './cache/cache.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly cacheService: CacheService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
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
