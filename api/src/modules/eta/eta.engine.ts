import { Injectable } from '@nestjs/common';
import { DeliveryRule } from '@prisma/client';

export const DEFAULT_ETA_RULES: Record<string, { min: number; max: number }> = {
  south:     { min: 2, max: 4 },  // TN, KA, KL, AP, TG, etc.
  west:      { min: 3, max: 5 },  // MH, GJ, GOA, etc.
  central:   { min: 4, max: 6 },  // MP, CG, RJ
  north:     { min: 5, max: 7 },  // DL, UP, HR, PB, UK, HP, JK, etc.
  east:      { min: 5, max: 7 },  // WB, OD, JH, BR
  northeast: { min: 7, max: 10 }, // AS, AR, MN, ML, MZ, NL, SK, TR
} as const;

@Injectable()
export class EtaEngine {
  /**
   * Blends tenant rules overrides with regional defaults to calculate the final delivery days.
   */
  calculate(region: string, tenantRules: DeliveryRule[]): { minDays: number; maxDays: number } {
    const normalizedRegion = region.toLowerCase().trim();

    // Check if there is an active tenant override rule for this region
    const activeOverride = tenantRules.find(
      (rule) => rule.region.toLowerCase().trim() === normalizedRegion && rule.isActive,
    );

    if (activeOverride) {
      return {
        minDays: activeOverride.minDays,
        maxDays: activeOverride.maxDays,
      };
    }

    // Fall back to system defaults
    const defaultRange = DEFAULT_ETA_RULES[normalizedRegion];
    if (defaultRange) {
      return {
        minDays: defaultRange.min,
        maxDays: defaultRange.max,
      };
    }

    // Ultimate fallback for safety (e.g. if region column has anomalous values)
    return {
      minDays: 5,
      maxDays: 7,
    };
  }
}
