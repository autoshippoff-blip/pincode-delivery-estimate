import { Module } from '@nestjs/common';
import { PincodeService } from './pincode.service';

@Module({
  providers: [PincodeService],
  exports: [PincodeService],
})
export class PincodeModule {}
