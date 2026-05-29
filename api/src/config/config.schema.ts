import { z } from 'zod';

export const configSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CACHE_TTL_PINCODE: z.coerce.number().default(3600),
  CACHE_TTL_TENANT: z.coerce.number().default(300),
  THROTTLE_TTL: z.coerce.number().default(60),
  THROTTLE_LIMIT: z.coerce.number().default(60),
});

export type Config = z.infer<typeof configSchema>;
