import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { DeliveryRule } from '@prisma/client';

@Injectable()
export class RuleResolver {
  private readonly CACHE_KEY_PREFIX = 'eta-rules:';
  private readonly CACHE_TTL = 300; // 5 minutes in seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async resolveRules(tenantId: string): Promise<DeliveryRule[]> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}${tenantId}`;

    // Read from cache
    const cachedRules = this.cache.get<DeliveryRule[]>(cacheKey);
    if (cachedRules) {
      return cachedRules;
    }

    // Query active delivery rules for the tenant
    const rules = await this.prisma.deliveryRule.findMany({
      where: {
        tenantId,
        isActive: true,
      },
    });

    // Cache resolved rules list
    this.cache.set(cacheKey, rules, this.CACHE_TTL);

    return rules;
  }
}
