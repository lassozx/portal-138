jest.mock('../src/config/prisma', () => ({ user: { findUnique: jest.fn() } }))
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const request = require('supertest')
const jwt = require('jsonwebtoken')
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'portal138-images-'))
process.env.UPLOAD_DIR = directory
const app = require('../src/app')
const prisma = require('../src/config/prisma')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR1sAAAAASUVORK5CYII=', 'base64')
let authorization
beforeEach(() => {
  jest.clearAllMocks()
  process.env.JWT_SECRET = 'test-secret-image-upload'
  authorization = `Bearer ${jwt.sign({ userId: 'editor-1' }, process.env.JWT_SECRET)}`
  prisma.user.findUnique.mockResolvedValue({ id: 'editor-1', role: 'EDITOR' })
})
afterAll(() => { fs.rmSync(directory, { recursive: true, force: true }); delete process.env.UPLOAD_DIR })

it('exige autenticação e bloqueia usuários comuns', async () => {
  expect((await request(app).post('/api/uploads').set('Content-Type', 'image/png').send(png)).status).toBe(401)
  prisma.user.findUnique.mockResolvedValue({ id: 'editor-1', role: 'USER' })
  expect((await request(app).post('/api/uploads').set('Authorization', authorization).set('Content-Type', 'image/png').send(png)).status).toBe(403)
  expect(fs.readdirSync(directory)).toHaveLength(0)
})

it.each(['EDITOR', 'ADMIN'])('permite upload por %s e entrega os mesmos bytes pela URL pública', async role => {
  prisma.user.findUnique.mockResolvedValue({ id: 'editor-1', role })
  const response = await request(app).post('/api/uploads').set('Authorization', authorization).set('Content-Type', 'image/png').send(png)
  expect(response.status).toBe(201)
  expect(response.body.url).toMatch(/^\/api\/uploads\/[a-f0-9-]{36}\.png$/)
  const image = await request(app).get(response.body.url)
  expect(image.status).toBe(200)
  expect(image.headers['content-type']).toContain('image/png')
  expect(image.headers['x-content-type-options']).toBe('nosniff')
  expect(image.body).toEqual(png)
})

it('rejeita SVG e conteúdo disfarçado de PNG sem criar arquivos', async () => {
  const count = fs.readdirSync(directory).length
  const svg = await request(app).post('/api/uploads').set('Authorization', authorization).set('Content-Type', 'image/svg+xml').send('<svg/>')
  expect(svg.status).toBe(415)
  const fake = await request(app).post('/api/uploads').set('Authorization', authorization).set('Content-Type', 'image/png').send(Buffer.from('<script>alert(1)</script>'))
  expect(fake.status).toBe(400)
  expect(fs.readdirSync(directory)).toHaveLength(count)
})

it('rejeita arquivos vazios e maiores que 5 MB', async () => {
  const count = fs.readdirSync(directory).length
  const empty = await request(app).post('/api/uploads').set('Authorization', authorization).set('Content-Type', 'image/png').send(Buffer.alloc(0))
  expect(empty.status).toBe(400)
  const large = await request(app).post('/api/uploads').set('Authorization', authorization).set('Content-Type', 'image/png').send(Buffer.alloc(5 * 1024 * 1024 + 1))
  expect(large.status).toBe(413)
  expect(fs.readdirSync(directory)).toHaveLength(count)
})

it('não entrega arquivos internos ou nomes não gerados pela API', async () => {
  expect((await request(app).get('/api/uploads/app.js')).status).toBe(404)
  expect((await request(app).get('/api/uploads/00000000-0000-0000-0000-000000000000.png')).status).toBe(404)
})

it.each([["image/jpeg", "jpg", "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q=="], ["image/webp", "webp", "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA="]])('aceita e serve um arquivo real %s', async (type, suffix, base64) => {
  const buffer = Buffer.from(base64, 'base64')
  const result = await request(app).post('/api/uploads').set('Authorization', authorization).set('Content-Type', type).send(buffer)
  expect(result.status).toBe(201)
  expect(result.body.url.endsWith(`.${suffix}`)).toBe(true)
  const image = await request(app).get(result.body.url)
  expect(image.status).toBe(200)
  expect(image.body).toEqual(buffer)
})
