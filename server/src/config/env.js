const { z } = require('zod')
const { getRuntimeConfig } = require('./runtime')

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL não foi definida'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('Erro na configuração das variáveis de ambiente:')

  for (const issue of result.error.issues) {
    console.error(`- ${issue.path.join('.')}: ${issue.message}`)
  }

  process.exit(1)
}

try {
  module.exports = { ...result.data, ...getRuntimeConfig() }
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
