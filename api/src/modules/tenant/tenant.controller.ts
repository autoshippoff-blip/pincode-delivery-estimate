import { Controller, Post, Body } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { SignupDto } from './dto/signup.dto';

@Controller('api/v1/tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    const tenant = await this.tenantService.createTenant(signupDto);
    return {
      success: true,
      message: 'Tenant registered successfully. Your API key has been sent to your email.',
      tenant: {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        siteUrl: tenant.siteUrl,
        shopDomain: tenant.shopDomain,
        apiKey: tenant.apiKey,
      },
    };
  }
}
