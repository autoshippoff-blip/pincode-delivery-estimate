import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Logs an API request audit trail to the PostgreSQL database.
   * Runs asynchronously (non-blocking) to optimize user response latency.
   */
  async logRequest(
    tenantId: string,
    pincode: string,
    responseTimeMs: number,
    success: boolean,
    state?: string | null,
    region?: string | null,
  ): Promise<void> {
    // Execute write asynchronously and catch errors to prevent request pipeline interruption
    this.prisma.apiLog
      .create({
        data: {
          tenantId,
          pincode,
          responseTimeMs,
          success,
          state: state || null,
          region: region || null,
        },
      })
      .catch((err) => {
        this.logger.error(`Failed to log analytics record for tenant ${tenantId} and pincode ${pincode}:`, err);
      });
  }
}
