jest.mock('../src/config/prisma', () => ({
  post: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
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