import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const AllowedOriginsSchema = z.object({
  allowedOrigins: z.array(z.string()).min(1, 'At least one allowed origin must be specified'),
});

export class AllowedOriginsDto extends createZodDto(AllowedOriginsSchema) {}
