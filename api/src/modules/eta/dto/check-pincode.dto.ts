import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const CheckPincodeSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
});

export class CheckPincodeDto extends createZodDto(CheckPincodeSchema) {}
