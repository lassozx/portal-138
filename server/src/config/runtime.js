const path = require('node:path')
const { z } = require('zod')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVE_CLIENT: z.enum(['true', 'false']).optional(),
  CLIENT_DIST_DIR: z.string().trim().min(1).optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  CORS_ORIGINS: z.string().default(''),
})

function getRuntimeConfig(source = process.env) {
  const result = schema.safeParse(source)
  if (!result.success) {
    throw new Error(`Configuração inválida: ${result.error.issues.map(issue => issue.path.join('.')).join(', ')}.`)
  }
  const config = result.data
  const allowedOrigins = [...new Set(config.CORS_ORIGINS.split(',').map(value => value.trim()).filter(Boolean).map(value => {
    let url
    try { url = new URL(value) } catch { throw new Error('CORS_ORIGINS deve conter origens HTTP ou HTTPS separadas por vírgula.') }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('CORS_ORIGINS aceita apenas origens HTTP ou HTTPS, sem caminhos ou credenciais.')
    }
    return url.origin
  }))]
  const isProduction = config.NODE_ENV === 'production'
  return {
    isProduction,
    serveClient: config.SERVE_CLIENT === undefined ? isProduction : config.SERVE_CLIENT === 'true',
    clientDirectory: path.resolve(__dirname, '../..', config.CLIENT_DIST_DIR || '../client/dist'),
    trustProxy: config.TRUST_PROXY,
    allowedOrigins,
  }
}

module.exports = { getRuntimeConfig }
