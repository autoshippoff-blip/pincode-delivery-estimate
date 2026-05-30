import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const SignupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  siteUrl: z.string().url('Site URL must be a valid URL'),
  shopDomain: z.string().optional(),
});

export class SignupDto extends createZodDto(SignupSchema) {}
