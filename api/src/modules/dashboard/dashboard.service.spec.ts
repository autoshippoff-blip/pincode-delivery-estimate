import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { NotFoundException } from '@nestjs/common';

describe('DashboardService', () => {
  let service: DashboardService;
  let prismaMock: any;
  let cacheMock: any;

  beforeEach(async () => {
    prismaMock = {
      tenant: {
        findUnique: jest.fn(),
      },
      apiLog: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      deliveryRule: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    };

    cacheMock = {
      del: jest.fn(),
      delPrefix: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CacheService, useValue: cacheMock },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('getStats', () => {
    it('should throw NotFoundException if tenant does not exist', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(null);
      await expect(service.getStats('non_existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should query metrics, rules, and return consolidated stats', async () => {
      const mockTenant = {
        id: 'tenant_123',
        name: 'Merchant Test',
        email: 'test@merchant.com',
        codEnabled: true,
        allowedOrigins: ['*'],
      };
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant);
      prismaMock.apiLog.count.mockResolvedValue(10);
      prismaMock.apiLog.groupBy.mockResolvedValue([
        { pincode: '560001', _count: { pincode: 5 } },
      ]);
      prismaMock.deliveryRule.findMany.mockResolvedValue([
        { region: 'south', minDays: 1, maxDays: 2, codBlockedPincodes: [] },
      ]);

      const result = await service.getStats('tenant_123');

      expect(result.tenant).toEqual(mockTenant);
      expect(result.rules).toHaveLength(1);
      expect(result.stats.requestHistory).toHaveLength(7);
      expect(result.stats.topPincodes[0]).toEqual({
        pincode: '560001',
        count: 5,
      });
    });
  });

  describe('updateRules', () => {
    it('should delete old rules, insert new rules, and invalidate cache', async () => {
      const payload = {
        rules: [
          {
            region: 'south',
            minDays: 2,
            maxDays: 4,
            codBlockedPincodes: ['627152'],
          },
        ],
      };

      prismaMock.deliveryRule.deleteMany.mockResolvedValue({ count: 1 });
      prismaMock.deliveryRule.createMany.mockResolvedValue({ count: 1 });

      const result = await service.updateRules('tenant_123', payload as any);

      expect(result.success).toBe(true);
      expect(prismaMock.deliveryRule.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant_123' },
      });
      expect(prismaMock.deliveryRule.createMany).toHaveBeenCalled();
      expect(cacheMock.del).toHaveBeenCalledWith('eta-rules:tenant_123');
      expect(cacheMock.delPrefix).toHaveBeenCalledWith('eta:tenant_123:');
    });
  });
});
