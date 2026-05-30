import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const DeliveryRuleInputSchema = z
  .object({
    region: z.string(),
    minDays: z.number().int().min(1, 'minDays must be at least 1'),
    maxDays: z.number().int().min(1, 'maxDays must be at least 1'),
    codBlockedPincodes: z
      .array(z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'))
      .default([]),
  })
  .refine((data) => data.minDays < data.maxDays, {
    message: 'minDays must be less than maxDays',
    path: ['minDays'],
  });

const UpdateRulesSchema = z.object({
  rules: z.array(DeliveryRuleInputSchema),
});

export class UpdateRulesDto extends createZodDto(UpdateRulesSchema) {}
