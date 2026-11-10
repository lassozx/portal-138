jest.mock('../../../src/config/prisma', () => ({ user: { findUnique: jest.fn() } }))
const request = require('supertest')
const jwt = require('jsonwebtoken')
const keys = ['UPLOAD_STORAGE', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_STORAGE_BUCKET']
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
Object.assign(process.env, { UPLOAD_STORAGE: 'supabase', SUPABASE_URL: 'https://portal-test.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test_only_2026' })
delete process.env.SUPABASE_STORAGE_BUCKET
const app = require('../../../src/app')
const prisma = require('../../../src/config/prisma')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR1sAAAAASUVORK5CYII=', 'base64')
const originalFetch = global.fetch
let authorization
beforeEach(() => {
  jest.clearAllMocks()
  process.env.JWT_SECRET = 'supabase-upload-unit-test-secret'
  authorization = `Bearer ${jwt.sign({ userId: 'editor-remote' }, process.env.JWT_SECRET)}`
  prisma.user.findUnique.mockResolvedValue({ id: 'editor-remote', role: 'EDITOR' })
  global.fetch = jest.fn().mockResolvedValue({ ok: true, body: { cancel: jest.fn() } })
})
afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks() })
afterAll(() => {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key]
    else process.env[key] = previous[key]
  }
})
const upload = (body = png, type = 'image/png') => request(app).post('/api/uploads').set('Authorization', authorization).set('Content-Type', type).send(body)

it('salva bytes validados no Supabase e devolve somente a URL pública, sem credenciais', async () => {
  const response = await upload()
  expect(response.status).toBe(201)
  expect(response.body.url).toMatch(/^https:\/\/portal-test\.supabase\.co\/storage\/v1\/object\/public\/portal-capas\/[a-f0-9-]{36}\.png$/)
  const [url, options] = global.fetch.mock.calls[0]
  expect(url).toBe(response.body.url.replace('/object/public/', '/object/'))
  expect(options.method).toBe('POST')
  expect(options.headers).toMatchObject({ apikey: 'sb_secret_test_only_2026', 'Content-Type': 'image/png', 'x-upsert': 'false' })
  expect(options.headers).not.toHaveProperty('Authorization')
  expect(options.body).toEqual(png)
  expect(options.redirect).toBe('error')
  expect(response.text).not.toContain('sb_secret_')
})
it('mantém a autenticação e a validação antes de chamar o armazenamento externo', async () => {
  expect((await request(app).post('/api/uploads').set('Content-Type', 'image/png').send(png)).status).toBe(401)
  prisma.user.findUnique.mockResolvedValueOnce({ id: 'editor-remote', role: 'USER' })
  expect((await upload()).status).toBe(403)
  expect((await upload(Buffer.from('<script>alert(1)</script>'))).status).toBe(400)
  expect((await upload(Buffer.from('<svg/>'), 'image/svg+xml')).status).toBe(415)
  expect((await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).status).toBe(413)
  expect(global.fetch).not.toHaveBeenCalled()
})
it.each(['http', 'network', 'timeout'])('não vaza respostas ou erros do provedor (%s)', async reason => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  const sensitive = 'provider detail sb_secret_test_only_2026'
  if (reason === 'http') global.fetch.mockResolvedValue({ ok: false, text: () => sensitive })
  else global.fetch.mockRejectedValue(Object.assign(new Error(sensitive), { name: reason === 'timeout' ? 'TimeoutError' : 'Error' }))
  const response = await upload()
  expect(response.status).toBe(502)
  expect(response.text).not.toContain('sb_secret_')
  expect(JSON.stringify(log.mock.calls)).not.toContain('sb_secret_')
})
it('não tenta entregar imagens remotas a partir do disco efêmero', async () => {
  expect((await request(app).get('/api/uploads/00000000-0000-0000-0000-000000000000.png')).status).toBe(404)
  expect(global.fetch).not.toHaveBeenCalled()
})
