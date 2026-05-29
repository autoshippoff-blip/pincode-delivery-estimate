import { Tenant, Pincode } from '@prisma/client';

export interface CourierStrategy {
  /**
   * Calculates the delivery ETA based on origin and destination.
   * Returns min/max days or null if unable to resolve.
   */
  calculateEta(
    originPincode: string,
    destination: Pincode,
    tenant: Tenant,
  ): Promise<{ minDays: number; maxDays: number } | null>;
}
