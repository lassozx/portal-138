jest.mock('../../../src/config/prisma', () => ({
  user: { findUnique: jest.fn() },
}))
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const request = require('supertest')
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'portal138-client-'))
const keys = ['NODE_ENV', 'SERVE_CLIENT', 'CLIENT_DIST_DIR', 'CORS_ORIGINS', 'TRUST_PROXY']
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
function makeApp(options = {}) {
  jest.resetModules()
  process.env.NODE_ENV = 'production'
  process.env.CLIENT_DIST_DIR = directory
  delete process.env.SERVE_CLIENT
  delete process.env.CORS_ORIGINS
  delete process.env.TRUST_PROXY
  Object.assign(process.env, options)
  return require('../../../src/app')
}
beforeAll(() => {
  fs.mkdirSync(path.join(directory, 'assets'))
  fs.mkdirSync(path.join(directory, 'images'))
  fs.writeFileSync(path.join(directory, 'index.html'), '<!doctype html><title>Portal 138</title><script type="module" src="/assets/app-123.js"></script>')
  fs.writeFileSync(path.join(directory, 'assets/app-123.js'), 'console.log("portal")')
  fs.writeFileSync(path.join(directory, 'images/logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
  fs.writeFileSync(path.join(directory, '.env'), 'NAO_ENTREGAR=segredo-de-teste')
})
afterEach(() => {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key]
    else process.env[key] = previous[key]
  }
})
afterAll(() => fs.rmSync(directory, { recursive: true, force: true }))

it('entrega o HTML sem cache longo e mantém as rotas da API no mesmo servidor', async () => {
  const app = makeApp()
  const response = await request(app).get('/')
  expect(response.status).toBe(200)
  expect(response.type).toBe('text/html')
  expect(response.text).toContain('Portal 138')
  expect(response.headers['cache-control']).toBe('no-cache')
  expect(response.headers['content-security-policy']).toContain("img-src 'self' data: https:")
  expect((await request(app).get('/api/health')).body.status).toBe('ok')
  expect((await request(app).get('/index.html')).headers['cache-control']).toBe('no-cache')
})

it('usa cache imutável nos assets com hash e entrega imagens fixas', async () => {
  const app = makeApp()
  const asset = await request(app).get('/assets/app-123.js')
  expect(asset.status).toBe(200)
  expect(asset.type).toMatch(/javascript/)
  expect(asset.headers['cache-control']).toContain('max-age=31536000')
  expect(asset.headers['cache-control']).toContain('immutable')
  const logo = await request(app).get('/images/logo.svg')
  expect(logo.status).toBe(200)
  expect(logo.type).toBe('image/svg+xml')
})

it.each(['/api/inexistente', '/assets/ausente.js', '/noticias/slug', '/.env'])('mantém 404 real para %s, sem substituir por index.html', async url => {
  const response = await request(makeApp()).get(url)
  expect(response.status).toBe(404)
  expect(response.type).toBe('application/json')
  expect(response.text).not.toContain('<!doctype')
  expect(response.text).not.toContain('segredo-de-teste')
})

it('só concede CORS às origens configuradas e valida a quantidade de proxies', async () => {
  const app = makeApp({ CORS_ORIGINS: 'https://portal.example', TRUST_PROXY: '1' })
  expect(app.get('trust proxy')).toBe(1)
  const allowed = await request(app).get('/api/health').set('Origin', 'https://portal.example')
  expect(allowed.headers['access-control-allow-origin']).toBe('https://portal.example')
  const other = await request(app).get('/api/health').set('Origin', 'https://outro.example')
  expect(other.headers['access-control-allow-origin']).toBeUndefined()
})

it('funciona como API separada quando SERVE_CLIENT está desligado', async () => {
  const app = makeApp({ SERVE_CLIENT: 'false', CLIENT_DIST_DIR: path.join(directory, 'ausente') })
  expect((await request(app).get('/api/health')).status).toBe(200)
  expect((await request(app).get('/')).status).toBe(404)
  expect((await request(app).get('/api-docs/')).status).toBe(200)
  const response = await request(app).get('/api/health').set('Origin', 'https://outro.example')
  expect(response.headers['access-control-allow-origin']).toBeUndefined()
})

it('não inicia o site completo se o build estiver ausente', () => {
  expect(() => makeApp({ CLIENT_DIST_DIR: path.join(directory, 'ausente') })).toThrow('npm --prefix client run build')
})
