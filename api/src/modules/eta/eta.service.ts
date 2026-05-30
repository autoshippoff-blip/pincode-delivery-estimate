import { Injectable, NotFoundException } from '@nestjs/common';
import { Tenant } from '@prisma/client';
import { PincodeService } from '../pincode/pincode.service';
import { RuleResolver } from './rule.resolver';
import { EtaEngine } from './eta.engine';
import { CacheService } from '../../cache/cache.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EtaResponseDto } from './dto/eta-response.dto';

@Injectable()
export class EtaService {
  private readonly CACHE_KEY_PREFIX = 'eta:';
  private readonly CACHE_TTL = 600; // 10 minutes in seconds

  constructor(
    private readonly pincodeService: PincodeService,
    private readonly ruleResolver: RuleResolver,
    private readonly etaEngine: EtaEngine,
    private readonly cache: CacheService,
    private readonly analytics: AnalyticsService,
  ) {}

  async checkPincode(pincode: string, tenant: Tenant): Promise<EtaResponseDto> {
    const startTime = Date.now();
    const cacheKey = `${this.CACHE_KEY_PREFIX}${tenant.id}:${pincode}`;

    // 1. Check if the full success response is cached
    const cachedResponse = this.cache.get<EtaResponseDto>(cacheKey);
    if (cachedResponse) {
      const responseTimeMs = Date.now() - startTime;
      // Log the cache-hit request asynchronously
      this.analytics.logRequest(
        tenant.id,
        pincode,
        responseTimeMs,
        true,
        cachedResponse.state,
        cachedResponse.region,
      );
      return cachedResponse;
    }

    // 2. Fetch pincode details (Region, district, state)
    const pincodeRecord = await this.pincodeService.findByPincode(pincode);
    if (!pincodeRecord) {
      const responseTimeMs = Date.now() - startTime;
      // Log failure to database
      this.analytics.logRequest(tenant.id, pincode, responseTimeMs, false, null, null);
      throw new NotFoundException('Pincode is not serviceable');
    }

    // 3. Resolve active tenant rules overrides
    const rules = await this.ruleResolver.resolveRules(tenant.id);

    // 4. Calculate delivery estimated range
    const { minDays, maxDays } = this.etaEngine.calculate(pincodeRecord.region, rules);
    const estimatedDelivery = `${minDays}-${maxDays} Days`;

    // 5. Evaluate COD Availability
    let codAvailable = false;
    if (tenant.codEnabled) {
      const activeRegionRule = rules.find((r) => r.region === pincodeRecord.region);
      if (activeRegionRule && activeRegionRule.codBlockedPincodes) {
        const isBlocked = activeRegionRule.codBlockedPincodes.includes(pincode);
        codAvailable = !isBlocked;
      } else {
        codAvailable = true;
      }
    }

    // 6. Construct success response
    const response: EtaResponseDto = {
      success: true,
      pincode: pincodeRecord.pincode,
      district: pincodeRecord.district,
      state: pincodeRecord.state,
      region: pincodeRecord.region,
      estimated_delivery: estimatedDelivery,
      serviceable: true,
      cod_available: tenant.codEnabled ? codAvailable : undefined,
    };

    // 6. Cache the success response
    this.cache.set(cacheKey, response, this.CACHE_TTL);

    // 7. Log analytics asynchronously
    const responseTimeMs = Date.now() - startTime;
    this.analytics.logRequest(
      tenant.id,
      pincode,
      responseTimeMs,
      true,
      pincodeRecord.state,
      pincodeRecord.region,
    );

    return response;
  }
}
