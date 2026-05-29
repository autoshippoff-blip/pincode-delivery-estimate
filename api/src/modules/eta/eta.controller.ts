import { Controller, Post, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiKeyGuard, RequestWithTenant } from '../../common/guards/api-key.guard';
import { CheckPincodeDto } from './dto/check-pincode.dto';
import { EtaService } from './eta.service';
import { EtaResponseDto } from './dto/eta-response.dto';

@Controller('api/v1')
@UseGuards(ApiKeyGuard)
export class EtaController {
  constructor(private readonly etaService: EtaService) {}

  @Post('check-pincode')
  @HttpCode(HttpStatus.OK)
  async checkPincode(
    @Body() dto: CheckPincodeDto,
    @Req() req: RequestWithTenant,
  ): Promise<EtaResponseDto> {
    return this.etaService.checkPincode(dto.pincode, req.tenant);
  }
}
