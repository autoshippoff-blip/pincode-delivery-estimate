import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { Tenant } from '@prisma/client';
import { TenantService } from '../../modules/tenant/tenant.service';

export interface RequestWithTenant extends Request {
  tenant: Tenant;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly tenantService: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    
    // Extract x-api-key header (supporting both lowercase and uppercase variations)
    const apiKeyHeader = request.headers['x-api-key'] || request.headers['X-API-Key'];
    
    if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
      throw new UnauthorizedException('Missing API key in headers');
    }

    const apiKey = apiKeyHeader.trim();
    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key format');
    }

    // Resolve tenant via service
    const tenant = await this.tenantService.findByApiKey(apiKey);
    
    if (!tenant) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!tenant.isActive) {
      throw new UnauthorizedException('Tenant account is suspended');
    }

    // CORS & Origin whitelisting enforcement (Production only, skipped for dashboard management endpoints)
    const isDashboardRoute = request.url ? request.url.includes('/api/v1/dashboard') : false;
    const origin = request.headers['origin'] || request.headers['referer'];
    if (!isDashboardRoute && process.env.NODE_ENV === 'production' && origin && typeof origin === 'string') {
      const allowedOrigins = tenant.allowedOrigins || [];
      if (!this.matchOrigin(origin, allowedOrigins)) {
        throw new UnauthorizedException('Origin not whitelisted for this API key');
      }
    }

    // Attach tenant to the request context
    request.tenant = tenant;
    
    return true;
  }

  private matchOrigin(origin: string, allowedOrigins: string[]): boolean {
    if (allowedOrigins.includes('*')) {
      return true;
    }

    let cleanOrigin = origin.trim().toLowerCase();
    try {
      const url = new URL(cleanOrigin);
      cleanOrigin = url.origin;
    } catch (e) {
      // Fallback if not a parseable URL
    }

    for (const allowed of allowedOrigins) {
      let cleanAllowed = allowed.trim().toLowerCase();
      try {
        const url = new URL(cleanAllowed);
        cleanAllowed = url.origin;
      } catch (e) {
        // Fallback if wildcard domain
      }

      if (cleanOrigin === cleanAllowed) {
        return true;
      }

      // Handle wildcards: e.g. https://*.myshopify.com
      if (cleanAllowed.includes('*')) {
        const regexStr = '^' + cleanAllowed
          .replace(/\./g, '\\.')
          .replace(/\//g, '\\/')
          .replace(/\*/g, '[a-zA-Z0-9-]+') + '$';
        try {
          const regex = new RegExp(regexStr);
          if (regex.test(cleanOrigin)) {
            return true;
          }
        } catch (e) {
          // Invalid regex format
        }
      }
    }

    return false;
  }
}
