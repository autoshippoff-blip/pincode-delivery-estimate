import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { UpdateRulesDto } from './dto/update-rules.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getStats(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        siteUrl: true,
        shopDomain: true,
        apiKey: true,
        codEnabled: true,
        allowedOrigins: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // 1. Calculate Request History for the last 7 days (parallel DB count queries)
    const requestHistory = await Promise.all(
      Array.from({ length: 7 }).map(async (_, idx) => {
        const date = new Date();
        date.setDate(date.getDate() - idx);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const count = await this.prisma.apiLog.count({
          where: {
            tenantId,
            createdAt: {
              gte: date,
              lt: nextDate,
            },
          },
        });

        // Format to YYYY-MM-DD
        const dateStr = date.toISOString().split('T')[0];
        return { date: dateStr, count };
      }),
    );

    // Order chronological (oldest first)
    requestHistory.reverse();

    // 2. Fetch Top 5 Checked Pincodes
    const topPincodesRaw = await this.prisma.apiLog.groupBy({
      by: ['pincode'],
      where: { tenantId },
      _count: { pincode: true },
      orderBy: {
        _count: {
          pincode: 'desc',
        },
      },
      take: 5,
    });

    const topPincodes = topPincodesRaw.map((item) => ({
      pincode: item.pincode,
      count: item._count.pincode,
    }));

    // 3. Fetch Top 5 Checked States
    const topStatesRaw = await this.prisma.apiLog.groupBy({
      by: ['state'],
      where: { tenantId, state: { not: null } },
      _count: { state: true },
      orderBy: {
        _count: {
          state: 'desc',
        },
      },
      take: 5,
    });

    const topStates = topStatesRaw.map((item) => ({
      state: item.state || 'Unknown',
      count: item._count.state,
    }));

    // 4. Fetch Tenant Delivery Rules
    const rules = await this.prisma.deliveryRule.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        region: true,
        minDays: true,
        maxDays: true,
        codBlockedPincodes: true,
      },
    });

    return {
      tenant,
      stats: {
        requestHistory,
        topPincodes,
        topStates,
      },
      rules,
    };
  }

  async updateRules(tenantId: string, updateRulesDto: UpdateRulesDto) {
    const { rules } = updateRulesDto;

    // Delete existing rules
    await this.prisma.deliveryRule.deleteMany({
      where: { tenantId },
    });

    // Create the updated rules
    await this.prisma.deliveryRule.createMany({
      data: rules.map((r) => ({
        tenantId,
        region: r.region,
        minDays: r.minDays,
        maxDays: r.maxDays,
        codBlockedPincodes: r.codBlockedPincodes,
        isActive: true,
      })),
    });

    // Clear caches
    this.cache.del(`eta-rules:${tenantId}`);
    this.cache.delPrefix(`eta:${tenantId}:`);

    return { success: true, message: 'Rules updated successfully' };
  }
}
