import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  private readonly startTime: number;

  constructor(private readonly prisma: PrismaService) {
    this.startTime = Date.now();
  }

  @Get()
  async checkHealth() {
    let dbStatus = 'disconnected';
    try {
      // Execute a simple query to verify database connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'error';
    }

    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      status: dbStatus === 'connected' ? 'ok' : 'error',
      db: dbStatus,
      uptime,
    };
  }
}
