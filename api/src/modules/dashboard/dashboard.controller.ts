import { Controller, Get, Post, Put, Body, UseGuards, Req } from '@nestjs/common';
import { ApiKeyGuard, RequestWithTenant } from '../../common/guards/api-key.guard';
import { DashboardService } from './dashboard.service';
import { TenantService } from '../tenant/tenant.service';
import { AllowedOriginsDto } from '../tenant/dto/allowed-origins.dto';
import { UpdateRulesDto } from './dto/update-rules.dto';
import { UpdateCodDto } from './dto/update-cod.dto';

@Controller('api/v1/dashboard')
@UseGuards(ApiKeyGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly tenantService: TenantService,
  ) {}

  @Get('stats')
  async getStats(@Req() req: RequestWithTenant) {
    return this.dashboardService.getStats(req.tenant.id);
  }

  @Post('regenerate-key')
  async regenerateKey(@Req() req: RequestWithTenant) {
    const newApiKey = await this.tenantService.regenerateApiKey(req.tenant.id);
    return {
      success: true,
      apiKey: newApiKey,
    };
  }

  @Put('allowed-origins')
  async updateAllowedOrigins(
    @Req() req: RequestWithTenant,
    @Body() dto: AllowedOriginsDto,
  ) {
    const updated = await this.tenantService.updateAllowedOrigins(
      req.tenant.id,
      dto.allowedOrigins,
    );
    return {
      success: true,
      allowedOrigins: updated.allowedOrigins,
    };
  }

  @Put('rules')
  async updateRules(@Req() req: RequestWithTenant, @Body() dto: UpdateRulesDto) {
    return this.dashboardService.updateRules(req.tenant.id, dto);
  }

  @Put('cod')
  async updateCod(@Req() req: RequestWithTenant, @Body() dto: UpdateCodDto) {
    const updated = await this.tenantService.updateCodEnabled(
      req.tenant.id,
      dto.codEnabled,
    );
    return {
      success: true,
      codEnabled: updated.codEnabled,
    };
  }
}
