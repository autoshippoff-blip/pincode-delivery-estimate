import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { Pincode } from '@prisma/client';

@Injectable()
export class PincodeService {
  private readonly CACHE_KEY_PREFIX = 'pincode:';
  private readonly cacheTtl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtl = this.configService.get<number>('CACHE_TTL_PINCODE', 3600);
  }

  async findByPincode(pincode: string): Promise<Pincode | null> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}${pincode}`;
    
    // Attempt cache read
    const cachedPincode = this.cache.get<Pincode>(cacheKey);
    if (cachedPincode) {
      return cachedPincode;
    }

    // Cache miss - query database
    const pincodeRecord = await this.prisma.pincode.findUnique({
      where: { pincode },
      select: {
        pincode: true,
        officeName: true,
        district: true,
        state: true,
        region: true,
        latitude: true,
        longitude: true,
      },
    });

    if (pincodeRecord) {
      // Cache the record
      this.cache.set(cacheKey, pincodeRecord, this.cacheTtl);
    }

    return pincodeRecord;
  }
}
