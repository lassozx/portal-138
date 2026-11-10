const path = require('node:path')
const { getRuntimeConfig } = require('../../../src/config/runtime')

it('mantém a API separada do Vite em desenvolvimento e serve o build em produção', () => {
  expect(getRuntimeConfig({}).serveClient).toBe(false)
  expect(getRuntimeConfig({ NODE_ENV: 'production' }).serveClient).toBe(true)
  expect(getRuntimeConfig({ NODE_ENV: 'production', SERVE_CLIENT: 'false' }).serveClient).toBe(false)
  expect(getRuntimeConfig({ SERVE_CLIENT: 'true' }).serveClient).toBe(true)
})

it('resolve o build relativo à pasta server, sem depender do diretório atual', () => {
  const server = path.resolve(__dirname, '../../..')
  expect(getRuntimeConfig({}).clientDirectory).toBe(path.resolve(server, '../client/dist'))
  expect(getRuntimeConfig({ CLIENT_DIST_DIR: 'frontend' }).clientDirectory).toBe(path.join(server, 'frontend'))
})

it('normaliza e deduplica origens exatas e mantém proxy desligado por padrão', () => {
  const runtime = getRuntimeConfig({ CORS_ORIGINS: ' https://portal.example/,https://portal.example,http://localhost:5173 ' })
  expect(runtime.allowedOrigins).toEqual(['https://portal.example', 'http://localhost:5173'])
  expect(runtime.trustProxy).toBe(0)
  expect(getRuntimeConfig({ TRUST_PROXY: '1' }).trustProxy).toBe(1)
})

it.each([
  { NODE_ENV: 'prod' }, { SERVE_CLIENT: 'yes' }, { TRUST_PROXY: 'true' }, { TRUST_PROXY: '-1' },
  { CORS_ORIGINS: '*' }, { CORS_ORIGINS: 'https://portal.example/caminho' },
  { CORS_ORIGINS: 'https://usuario:senha@portal.example' }, { CORS_ORIGINS: 'javascript:alert(1)' },
])('rejeita configuração ambígua ou inválida: %j', source => {
  expect(() => getRuntimeConfig(source)).toThrow()
})
