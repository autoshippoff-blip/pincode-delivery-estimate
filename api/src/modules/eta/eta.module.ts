import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { PincodeModule } from '../pincode/pincode.module';
import { EtaController } from './eta.controller';
import { EtaService } from './eta.service';
import { EtaEngine } from './eta.engine';
import { RuleResolver } from './rule.resolver';

@Module({
  imports: [TenantModule, PincodeModule],
  controllers: [EtaController],
  providers: [EtaService, EtaEngine, RuleResolver],
})
export class EtaModule {}
