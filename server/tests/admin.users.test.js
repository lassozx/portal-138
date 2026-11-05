jest.mock('../src/config/prisma', () => ({
  user: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
}))
const request = require('supertest')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const app = require('../src/app')
const prisma = require('../src/config/prisma')
let authorization
let tx
beforeEach(() => {
  jest.resetAllMocks()
  process.env.JWT_SECRET = 'test-secret-user-management'
  authorization = `Bearer ${jwt.sign({ userId: 'admin-1' }, process.env.JWT_SECRET)}`
  prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', name: 'Admin', role: 'ADMIN' })
  tx = { $queryRaw: jest.fn().mockResolvedValue([{ id: 'admin-1' }]), user: { findUnique: jest.fn(), update: jest.fn() } }
  tx.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' }).mockResolvedValueOnce({ id: 'target-1', role: 'USER' })
  tx.user.update.mockResolvedValue({ id: 'target-1', role: 'EDITOR' })
  prisma.$transaction.mockImplementation(fn => fn(tx))
})

it.each(['get', 'post', 'patch'])('bloqueia %s sem autenticação e para editores', async method => {
  const url = method === 'patch' ? '/api/admin/users/target-1/role' : '/api/admin/users'
  expect((await request(app)[method](url).send({})).status).toBe(401)
  prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'EDITOR' })
  expect((await request(app)[method](url).set('Authorization', authorization).send({})).status).toBe(403)
  expect(prisma.user.create).not.toHaveBeenCalled()
  expect(prisma.$transaction).not.toHaveBeenCalled()
})

it('pagina e filtra usuários sem selecionar hashes de senha', async () => {
  prisma.user.count.mockResolvedValue(21)
  prisma.user.findMany.mockResolvedValue([{ id: 'u', name: 'Ana', email: 'ana@teste.com', role: 'EDITOR' }])
  const r = await request(app).get('/api/admin/users?page=2&search=ana&role=EDITOR').set('Authorization', authorization)
  expect(r.status).toBe(200)
  expect(r.body.pagination).toMatchObject({ total: 21, page: 2, totalPages: 2 })
  const options = prisma.user.findMany.mock.calls[0][0]
  expect(options.skip).toBe(20)
  expect(options.where.role).toBe('EDITOR')
  expect(options.where.OR[0].name).toEqual({ contains: 'ana', mode: 'insensitive' })
  expect(options.select).not.toHaveProperty('passwordHash')
})

it('rejeita filtros e perfis inválidos, inclusive campos adicionais', async () => {
  expect((await request(app).get('/api/admin/users?page=0').set('Authorization', authorization)).status).toBe(400)
  expect((await request(app).patch('/api/admin/users/target-1/role').set('Authorization', authorization).send({ role: 'OWNER' })).status).toBe(400)
  expect((await request(app).patch('/api/admin/users/target-1/role').set('Authorization', authorization).send({ role: 'ADMIN', passwordHash: 'fake' })).status).toBe(400)
  expect(prisma.$transaction).not.toHaveBeenCalled()
})

it('cria uma conta com e-mail normalizado e senha armazenada como hash', async () => {
  prisma.user.create.mockResolvedValue({ id: 'u', name: 'Ana', email: 'ana@teste.com', role: 'EDITOR' })
  const r = await request(app).post('/api/admin/users').set('Authorization', authorization).send({ name: 'Ana', email: 'ANA@teste.com', password: 'SenhaInicial123', role: 'EDITOR' })
  expect(r.status).toBe(201)
  const args = prisma.user.create.mock.calls[0][0]
  expect(args.data.email).toBe('ana@teste.com')
  expect(await bcrypt.compare('SenhaInicial123', args.data.passwordHash)).toBe(true)
  expect(args.select).not.toHaveProperty('passwordHash')
  expect(r.body.user).not.toHaveProperty('passwordHash')
})

it('rejeita senhas curtas, longas em UTF-8 e e-mails duplicados', async () => {
  for (const password of ['curta', '🔒'.repeat(20)]) {
    const r = await request(app).post('/api/admin/users').set('Authorization', authorization).send({ name: 'Ana', email: 'ana@teste.com', password, role: 'ADMIN' })
    expect(r.status).toBe(400)
  }
  prisma.user.create.mockRejectedValue({ code: 'P2002' })
  const r = await request(app).post('/api/admin/users').set('Authorization', authorization).send({ name: 'Ana', email: 'ana@teste.com', password: 'SenhaInicial123', role: 'ADMIN' })
  expect(r.status).toBe(409)
})

it.each(['ADMIN', 'EDITOR', 'USER'])('altera o perfil de outra conta para %s dentro de transação', async role => {
  const r = await request(app).patch('/api/admin/users/target-1/role').set('Authorization', authorization).send({ role })
  expect(r.status).toBe(200)
  expect(tx.$queryRaw).toHaveBeenCalled()
  expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'target-1' }, data: { role } }))
})

it('impede a alteração do próprio acesso, preservando o administrador', async () => {
  const r = await request(app).patch('/api/admin/users/admin-1/role').set('Authorization', authorization).send({ role: 'USER' })
  expect(r.status).toBe(409)
  expect(prisma.$transaction).not.toHaveBeenCalled()
})

it('reconfere o administrador após o bloqueio para impedir revogações simultâneas', async () => {
  tx.user.findUnique.mockReset().mockResolvedValue({ role: 'EDITOR' })
  const r = await request(app).patch('/api/admin/users/target-1/role').set('Authorization', authorization).send({ role: 'USER' })
  expect(r.status).toBe(403)
  expect(tx.user.update).not.toHaveBeenCalled()
})

it('informa quando a conta foi removida antes da alteração', async () => {
  tx.user.findUnique.mockReset().mockResolvedValueOnce({ role: 'ADMIN' }).mockResolvedValueOnce(null)
  const r = await request(app).patch('/api/admin/users/target-1/role').set('Authorization', authorization).send({ role: 'EDITOR' })
  expect(r.status).toBe(404)
  expect(tx.user.update).not.toHaveBeenCalled()
})
