require('dotenv').config();
const { z } = require('zod');

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ORG_SECRET: z.string().min(1),
  JWT_VOL_SECRET: z.string().min(1),
  PORT: z.string().regex(/^\d+$/).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

module.exports = parsedEnv.data;
