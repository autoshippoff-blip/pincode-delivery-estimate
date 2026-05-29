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

    // Attach tenant to the request context
    request.tenant = tenant;
    
    return true;
  }
}
