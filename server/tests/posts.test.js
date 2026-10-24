jest.mock('../src/config/prisma', () => ({
  post: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  category: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
}))

const request = require('supertest')
const app = require('../src/app')
const prisma = require('../src/config/prisma')

describe('GET /api/posts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deve listar notícias publicadas com paginação', async () => {
    prisma.$transaction.mockResolvedValue([
      [
        {
          id: 'noticia-1',
          title: 'Notícia de teste',
          slug: 'noticia-de-teste',
          status: 'PUBLISHED',
        },
      ],
      1,
    ])

    const response = await request(app).get('/api/posts')

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].slug).toBe('noticia-de-teste')
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('deve rejeitar uma página inválida', async () => {
    const response = await request(app).get('/api/posts?page=0')

    expect(response.status).toBe(400)
    expect(response.body.message).toBe(
      'A página deve ser um inteiro positivo e o limite deve ser um inteiro entre 1 e 100.'
    )
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('deve rejeitar um limite maior que 100', async () => {
    const response = await request(app).get('/api/posts?limit=101')

    expect(response.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('deve rejeitar uma ordenação inválida', async () => {
    const response = await request(app).get('/api/posts?sort=aleatoria')

    expect(response.status).toBe(400)
    expect(response.body.message).toBe(
      'Ordenação inválida. Use "latest" ou "oldest".'
    )
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

describe('GET /api/posts/:slug', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deve retornar uma notícia publicada pelo slug', async () => {
    prisma.post.findFirst.mockResolvedValue({
      id: 'noticia-1',
      title: 'Notícia de teste',
      slug: 'noticia-de-teste',
      status: 'PUBLISHED',
    })

    const response = await request(app).get(
      '/api/posts/noticia-de-teste'
    )

    expect(response.status).toBe(200)
    expect(response.body.slug).toBe('noticia-de-teste')
    expect(prisma.post.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          slug: 'noticia-de-teste',
          status: 'PUBLISHED',
        }),
      })
    )
  })

  it('deve retornar 404 quando a notícia não existe', async () => {
    prisma.post.findFirst.mockResolvedValue(null)

    const response = await request(app).get(
      '/api/posts/noticia-inexistente'
    )

    expect(response.status).toBe(404)
    expect(response.body.message).toBe('Notícia não encontrada.')
  })
})

describe('POST /api/posts', () => {
  let tokenAdmin
  let tokenUser

  beforeEach(() => {
    jest.clearAllMocks()

    process.env.JWT_SECRET = 'segredo-de-teste-jwt'

    const jwt = require('jsonwebtoken')

    tokenAdmin = jwt.sign(
      { userId: 'admin-teste-id' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )

    tokenUser = jwt.sign(
      { userId: 'user-teste-id' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )
  })

  it('deve rejeitar uma criação sem token', async () => {
    const response = await request(app)
      .post('/api/posts')
      .send({
        title: 'Nova notícia',
        slug: 'nova-noticia',
        content: 'Conteúdo da notícia.',
      })

    expect(response.status).toBe(401)
    expect(prisma.post.findUnique).not.toHaveBeenCalled()
  })

  it('deve rejeitar um usuário comum', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-teste-id',
      name: 'Usuário Teste',
      email: 'usuario@exemplo.com',
      role: 'USER',
    })

    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({
        title: 'Nova notícia',
        slug: 'nova-noticia',
        content: 'Conteúdo da notícia.',
      })

    expect(response.status).toBe(403)
    expect(response.body.message).toBe(
      'Você não tem permissão para realizar esta ação.'
    )
    expect(prisma.post.findUnique).not.toHaveBeenCalled()
  })

  it('deve rejeitar dados obrigatórios ausentes', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-teste-id',
      name: 'Administrador Teste',
      email: 'admin@exemplo.com',
      role: 'ADMIN',
    })

    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        title: 'Notícia sem conteúdo',
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe(
      'Título, slug e conteúdo são obrigatórios.'
    )
    expect(prisma.post.findUnique).not.toHaveBeenCalled()
  })

  it('deve rejeitar um slug já existente', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-teste-id',
      name: 'Administrador Teste',
      email: 'admin@exemplo.com',
      role: 'ADMIN',
    })

    prisma.post.findUnique.mockResolvedValue({
      id: 'noticia-existente-id',
      slug: 'noticia-existente',
    })

    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        title: 'Notícia duplicada',
        slug: 'noticia-existente',
        content: 'Conteúdo de teste.',
      })

    expect(response.status).toBe(409)
    expect(response.body.message).toBe(
      'Já existe uma notícia com esse slug.'
    )
    expect(prisma.post.create).not.toHaveBeenCalled()
  })

  it('deve criar uma notícia como rascunho para um administrador', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-teste-id',
      name: 'Administrador Teste',
      email: 'admin@exemplo.com',
      role: 'ADMIN',
    })

    prisma.post.findUnique.mockResolvedValue(null)

    prisma.post.create = jest.fn().mockImplementation(async ({ data }) => ({
      id: 'nova-noticia-id',
      ...data,
    }))

    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        title: 'Nova notícia',
        slug: 'nova-noticia',
        content: 'Conteúdo da notícia.',
      })

    expect(response.status).toBe(201)
    expect(response.body.message).toBe(
      'Notícia criada como rascunho.'
    )
    expect(response.body.post).toMatchObject({
      id: 'nova-noticia-id',
      title: 'Nova notícia',
      slug: 'nova-noticia',
      status: 'DRAFT',
      authorId: 'admin-teste-id',
    })
  })
})