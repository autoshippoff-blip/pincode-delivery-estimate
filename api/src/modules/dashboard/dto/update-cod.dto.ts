import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const UpdateCodSchema = z.object({
  codEnabled: z.boolean(),
});

export class UpdateCodDto extends createZodDto(UpdateCodSchema) {}
