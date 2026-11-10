const request = require('supertest')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { randomUUID } = require('node:crypto')
const prisma = require('../../src/config/prisma')
const app = require('../../src/app')

const prefix = `security-${randomUUID()}`
const password = 'Security-test-only-2026!'
const users = []
const posts = []
let admin, editor, reader, other, draft, published
const tokenFor = (user, payload = {}) => jwt.sign({ userId: user.id, sessionVersion: user.sessionVersion, ...payload }, process.env.JWT_SECRET, { expiresIn: '1h' })
const as = user => ({ Authorization: `Bearer ${tokenFor(user)}` })

beforeAll(async () => {
  const passwordHash = await bcrypt.hash(password, 12)
  for (const role of ['ADMIN', 'EDITOR', 'USER', 'USER']) {
    users.push(await prisma.user.create({ data: { name: `Security ${role}`, email: `${prefix}-${users.length}@example.invalid`, passwordHash, role } }))
  }
  ;[admin, editor, reader, other] = users
  for (const status of ['DRAFT', 'PUBLISHED']) {
    posts.push(await prisma.post.create({ data: {
      title: `Security ${status}`, slug: `${prefix}-${status.toLowerCase()}`, content: 'Conteúdo de teste isolado.',
      status, publishedAt: status === 'PUBLISHED' ? new Date() : null, authorId: admin.id,
    } }))
  }
  ;[draft, published] = posts
})
afterAll(async () => {
  await prisma.post.deleteMany({ where: { id: { in: posts.map(p => p.id) } } })
  await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } })
  await prisma.$disconnect()
})

describe('SQL injection com banco real', () => {
  it.each(["' OR 1=1 --", "'); DROP TABLE \"User\"; --"])('trata a busca como texto: %s', async search => {
    const response = await request(app).get('/api/posts').query({ search })
    expect(response.status).toBe(200)
    expect(response.body.data).toEqual([])
    expect(await prisma.user.count({ where: { id: { in: users.map(u => u.id) } } })).toBe(4)
    const lookup = await request(app).get(`/api/posts/${encodeURIComponent(search)}`)
    expect(lookup.status).toBe(404)
  })
  it('não autentica usando uma expressão SQL no e-mail', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: "' OR 1=1 --", password })
    expect(response.status).toBe(400)
    expect(response.body).not.toHaveProperty('token')
  })
  it('grava conteúdo malicioso como dado literal, sem executar SQL', async () => {
    const content = "'); UPDATE \"User\" SET role='ADMIN'; --"
    const response = await request(app).post('/api/comments').set(as(reader)).send({ content, postId: published.id })
    expect(response.status).toBe(201)
    expect(response.body.comment.content).toBe(content)
    expect((await prisma.user.findUnique({ where: { id: reader.id } })).role).toBe('USER')
  })
})

describe('Controle de acesso e objetos de outros usuários', () => {
  it.each(['/api/admin/users', '/api/admin/posts'])('bloqueia anônimos e usuários comuns em %s', async url => {
    expect((await request(app).get(url)).status).toBe(401)
    expect((await request(app).get(url).set(as(reader))).status).toBe(403)
  })
  it('não aceita um perfil ADMIN no token como permissão no banco', async () => {
    const token = tokenFor(reader, { role: 'ADMIN' })
    expect((await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`)).status).toBe(403)
  })
  it('não permite promover a própria conta pelo perfil', async () => {
    const response = await request(app).put('/api/auth/profile').set(as(reader)).send({ name: 'Security Reader', role: 'ADMIN', sessionVersion: 99 })
    expect(response.status).toBe(200)
    const user = await prisma.user.findUnique({ where: { id: reader.id } })
    expect(user.role).toBe('USER')
    expect(user.sessionVersion).toBe(0)
  })
  it('não expõe rascunhos ou comentários de rascunhos', async () => {
    expect((await request(app).get(`/api/posts/${draft.slug}`)).status).toBe(404)
    expect((await request(app).get(`/api/comments/post/${draft.id}`)).status).toBe(404)
    expect((await request(app).post('/api/comments').set(as(reader)).send({ postId: draft.id, content: 'Tentar comentar' })).status).toBe(404)
  })
  it('não permite excluir o comentário de outra pessoa', async () => {
    const comment = await prisma.comment.create({ data: { content: 'Comentário privado do autor', postId: published.id, authorId: other.id } })
    expect((await request(app).delete(`/api/comments/${comment.id}`).set(as(reader))).status).toBe(403)
    expect(await prisma.comment.findUnique({ where: { id: comment.id } })).not.toBeNull()
  })
  it('bloqueia publicação, exclusão e gerenciamento de usuários por editor', async () => {
    expect((await request(app).put(`/api/posts/${draft.id}`).set(as(editor)).send({ status: 'PUBLISHED' })).status).toBe(403)
    expect((await request(app).delete(`/api/posts/${draft.id}`).set(as(editor))).status).toBe(403)
    expect((await request(app).patch(`/api/admin/users/${reader.id}/role`).set(as(editor)).send({ role: 'ADMIN' })).status).toBe(403)
  })
})

describe('CSRF e tokens adulterados', () => {
  it.each(['application/json', 'application/x-www-form-urlencoded', 'text/plain'])('não usa cookies como autenticação em um POST externo (%s)', async type => {
    const body = { postId: published.id, content: 'Tentativa CSRF' }
    const response = await request(app).post('/api/comments')
      .set('Origin', 'https://attacker.example').set('Cookie', `token=${tokenFor(reader)}`)
      .set('Content-Type', type).send(type === 'application/json' ? body : JSON.stringify(body))
    expect(response.status).toBe(401)
    expect(await prisma.comment.count({ where: { content: body.content, postId: published.id } })).toBe(0)
  })
  it.each(['none', 'HS384'])('rejeita algoritmo JWT %s', async algorithm => {
    const token = jwt.sign({ userId: admin.id }, algorithm === 'none' ? null : process.env.JWT_SECRET, { algorithm })
    expect((await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`)).status).toBe(401)
  })
  it('rejeita token com assinatura adulterada', async () => {
    const token = tokenFor(admin)
    const parts = token.split('.')
    parts[1] = Buffer.from(JSON.stringify({ userId: other.id, role: 'ADMIN' })).toString('base64url')
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${parts.join('.')}`)).status).toBe(401)
  })
})

describe('Revogação de sessões após troca de senha', () => {
  it('limita tentativas da senha atual na rota real e não bloqueia alterar o nome', async () => {
    for (let index = 0; index < 10; index++) {
      const response = await request(app).put('/api/auth/profile').set(as(reader))
        .send({ currentPassword: 'Incorrect-password', newPassword: 'New-security-password-2026!' })
      expect(response.status).toBe(400)
    }
    expect((await request(app).put('/api/auth/profile').set(as(reader))
      .send({ currentPassword: password, newPassword: 'New-security-password-2026!' })).status).toBe(429)
    expect((await request(app).put('/api/auth/profile').set(as(reader)).send({ name: 'Security Reader' })).status).toBe(200)
  }, 15000)

  it('revoga tokens antigos, renova a sessão atual e aceita apenas a nova senha no próximo login', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: other.email, password })
    expect(login.status).toBe(200)
    const oldToken = login.body.token
    const legacyToken = jwt.sign({ userId: other.id }, process.env.JWT_SECRET, { expiresIn: '1h' })
    const response = await request(app).put('/api/auth/profile').set('Authorization', `Bearer ${oldToken}`).send({ currentPassword: password, newPassword: 'Updated-security-test-2026!' })
    expect(response.status).toBe(200)
    expect(response.body.user).not.toHaveProperty('sessionVersion')
    expect(response.body.user).not.toHaveProperty('passwordHash')
    expect(jwt.verify(response.body.token, process.env.JWT_SECRET).sessionVersion).toBe(1)
    for (const token of [oldToken, legacyToken]) {
      expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(401)
      expect((await request(app).put('/api/auth/profile').set('Authorization', `Bearer ${token}`).send({ name: 'Stolen session' })).status).toBe(401)
    }
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${response.body.token}`)
    expect(me.status).toBe(200)
    expect(me.headers['cache-control']).toBe('no-store')
    expect(me.body.user).not.toHaveProperty('sessionVersion')
    expect((await request(app).post('/api/auth/login').send({ email: other.email, password })).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send({ email: other.email, password: 'Updated-security-test-2026!' })).status).toBe(200)
  })
})
