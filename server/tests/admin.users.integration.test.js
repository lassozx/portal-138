const request = require('supertest')
const jwt = require('jsonwebtoken')
const { randomUUID } = require('node:crypto')
const prisma = require('../src/config/prisma')
const app = require('../src/app')
const ids = []
const prefix = `portal-test-${randomUUID()}`
let admin, editor
let authorization
beforeAll(async () => {
  admin = await prisma.user.create({ data: { name: 'Admin integração', email: `${prefix}-admin@example.com`, passwordHash: 'unused-test-hash', role: 'ADMIN' } })
  ids.push(admin.id)
  editor = await prisma.user.create({ data: { name: 'Editor integração', email: `${prefix}-editor@example.com`, passwordHash: 'unused-test-hash', role: 'EDITOR' } })
  ids.push(editor.id)
  process.env.JWT_SECRET = 'integration-test-secret-at-least-32-characters'
  authorization = `Bearer ${jwt.sign({ userId: admin.id }, process.env.JWT_SECRET)}`
})
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
  await prisma.$disconnect()
})

it('altera perfis com bloqueio real no banco e aplica a revogação na próxima requisição', async () => {
  const promote = await request(app).patch(`/api/admin/users/${editor.id}/role`).set('Authorization', authorization).send({ role: 'ADMIN' })
  expect(promote.status).toBe(200)
  expect((await prisma.user.findUnique({ where: { id: editor.id } })).role).toBe('ADMIN')
  const editorAuthorization = `Bearer ${jwt.sign({ userId: editor.id }, process.env.JWT_SECRET)}`
  expect((await request(app).get('/api/admin/users').set('Authorization', editorAuthorization)).status).toBe(200)
  const demote = await request(app).patch(`/api/admin/users/${editor.id}/role`).set('Authorization', authorization).send({ role: 'EDITOR' })
  expect(demote.status).toBe(200)
  expect((await request(app).get('/api/admin/users').set('Authorization', editorAuthorization)).status).toBe(403)
  expect((await request(app).patch(`/api/admin/users/${admin.id}/role`).set('Authorization', authorization).send({ role: 'USER' })).status).toBe(409)
  expect((await prisma.user.findUnique({ where: { id: admin.id } })).role).toBe('ADMIN')
})
