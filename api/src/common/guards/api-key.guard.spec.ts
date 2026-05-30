import { ApiKeyGuard } from './api-key.guard';
import { TenantService } from '../../modules/tenant/tenant.service';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let tenantServiceMock: jest.Mocked<TenantService>;

  beforeEach(() => {
    tenantServiceMock = {
      findByApiKey: jest.fn(),
    } as any;
    guard = new ApiKeyGuard(tenantServiceMock);
  });

  const createMockContext = (headers: Record<string, string>, nodeEnv = 'production'): ExecutionContext => {
    process.env.NODE_ENV = nodeEnv;
    
    const req = {
      headers,
    };
    
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as any;
  };

  describe('API Key Authentication', () => {
    it('should throw UnauthorizedException if API key is missing', async () => {
      const context = createMockContext({});
      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Missing API key in headers'),
      );
    });

    it('should throw UnauthorizedException if API key format is empty', async () => {
      const context = createMockContext({ 'x-api-key': '   ' });
      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Invalid API key format'),
      );
    });

    it('should throw UnauthorizedException if API key is invalid', async () => {
      tenantServiceMock.findByApiKey.mockResolvedValue(null);
      const context = createMockContext({ 'x-api-key': 'invalid_key' });
      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Invalid API key'),
      );
    });

    it('should throw UnauthorizedException if tenant is inactive', async () => {
      tenantServiceMock.findByApiKey.mockResolvedValue({
        id: '1',
        name: 'Test Tenant',
        isActive: false,
        apiKey: 'key',
        allowedOrigins: ['*'],
      } as any);
      const context = createMockContext({ 'x-api-key': 'key' });
      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Tenant account is suspended'),
      );
    });
  });

  describe('CORS & Origin whitelisting', () => {
    beforeEach(() => {
      tenantServiceMock.findByApiKey.mockResolvedValue({
        id: '1',
        name: 'Test Tenant',
        isActive: true,
        apiKey: 'key',
        allowedOrigins: ['https://mystore.com', 'https://*.myshopify.com'],
      } as any);
    });

    it('should allow valid exact origin', async () => {
      const context = createMockContext({
        'x-api-key': 'key',
        origin: 'https://mystore.com',
      });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow valid referer exact origin', async () => {
      const context = createMockContext({
        'x-api-key': 'key',
        referer: 'https://mystore.com/products/sweater',
      });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow valid wildcard subdomain', async () => {
      const context = createMockContext({
        'x-api-key': 'key',
        origin: 'https://test-shop.myshopify.com',
      });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException for unauthorized origin', async () => {
      const context = createMockContext({
        'x-api-key': 'key',
        origin: 'https://attacker.com',
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Origin not whitelisted for this API key'),
      );
    });

    it('should bypass origin check in non-production environments', async () => {
      const context = createMockContext(
        {
          'x-api-key': 'key',
          origin: 'https://attacker.com',
        },
        'development',
      );
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should bypass origin check if origin header is missing', async () => {
      const context = createMockContext({
        'x-api-key': 'key',
      });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });
});
