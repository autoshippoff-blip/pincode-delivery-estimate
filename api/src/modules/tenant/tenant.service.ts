import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { Tenant } from '@prisma/client';

@Injectable()
export class TenantService {
  private readonly CACHE_KEY_PREFIX = 'tenant:';
  private readonly CACHE_TTL = 300; // 5 minutes in seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findByApiKey(apiKey: string): Promise<Tenant | null> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}${apiKey}`;
    
    // Attempt to read from cache first
    const cachedTenant = this.cache.get<Tenant>(cacheKey);
    if (cachedTenant) {
      return cachedTenant;
    }

    // Cache miss - query the database
    // We only select the columns needed for validation/routing to keep query lightweight
    const tenant = await this.prisma.tenant.findUnique({
      where: { apiKey },
    });

    if (tenant) {
      // Cache the resolved tenant
      this.cache.set(cacheKey, tenant, this.CACHE_TTL);
    }

    return tenant;
  }
}
