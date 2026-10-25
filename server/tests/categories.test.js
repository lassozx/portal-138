jest.mock('../src/config/prisma', () => ({
  category: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
}))

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../src/app')
const prisma = require('../src/config/prisma')

describe('GET /api/categories', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deve listar categorias publicamente', async () => {
    prisma.category.findMany.mockResolvedValue([
      {
        id: 'categoria-1',
        name: 'Notícias da Escola',
        slug: 'noticias-da-escola',
        _count: { posts: 2 },
      },
    ])

    const response = await request(app).get('/api/categories')

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(1)
    expect(response.body[0].name).toBe('Notícias da Escola')
    expect(prisma.category.findMany).toHaveBeenCalled()
  })

  it('deve retornar uma lista vazia quando não houver categorias', async () => {
    prisma.category.findMany.mockResolvedValue([])

    const response = await request(app).get('/api/categories')

    expect(response.status).toBe(200)
    expect(response.body).toEqual([])
  })

  it('deve retornar 500 quando ocorrer um erro ao listar categorias', async () => {
  prisma.category.findMany.mockRejectedValue(
    new Error('Erro no banco de dados')
  )

  const response = await request(app).get('/api/categories')

  expect(response.status).toBe(500)
  expect(response.body.message).toBe(
    'Erro interno ao listar categorias.'
  )
})

})

describe('POST /api/categories', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = 'segredo-teste-portal138'
  })

  function createToken(userId = 'admin-id') {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )
  }

  function mockAdmin() {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-id',
      name: 'Administrador',
      email: 'admin@teste.com',
      role: 'ADMIN',
    })
  }

  it('deve retornar 401 sem token', async () => {
    const response = await request(app)
      .post('/api/categories')
      .send({
        name: 'Eventos',
        slug: 'eventos',
      })

    expect(response.status).toBe(401)
  })

  it('deve retornar 403 para usuário comum', async () => {
    const token = createToken('usuario-id')

    prisma.user.findUnique.mockResolvedValue({
      id: 'usuario-id',
      name: 'Usuário',
      email: 'usuario@teste.com',
      role: 'USER',
    })

    const response = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Eventos',
        slug: 'eventos',
      })

    expect(response.status).toBe(403)
  })

  it('deve retornar 400 quando os dados forem inválidos', async () => {
    mockAdmin()

    const response = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({
        name: 'A',
        slug: 'Slug Inválido',
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Dados da categoria inválidos.')
  })

  it('deve retornar 409 quando o nome ou slug já existir', async () => {
    mockAdmin()

    prisma.category.findFirst.mockResolvedValue({
      id: 'categoria-existente',
      name: 'Eventos',
      slug: 'eventos',
    })

    const response = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({
        name: 'Eventos',
        slug: 'eventos',
      })

    expect(response.status).toBe(409)
  })

  it('deve criar uma categoria e retornar 201', async () => {
    mockAdmin()

    prisma.category.findFirst.mockResolvedValue(null)

    prisma.category.create.mockResolvedValue({
      id: 'categoria-nova',
      name: 'Eventos',
      slug: 'eventos',
      description: null,
    })

    const response = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({
        name: 'Eventos',
        slug: 'eventos',
      })

    expect(response.status).toBe(201)
    expect(response.body.message).toBe('Categoria criada com sucesso.')
    expect(response.body.category.name).toBe('Eventos')
    expect(prisma.category.create).toHaveBeenCalled()
  })

    it('deve retornar 500 quando ocorrer um erro ao cadastrar categoria', async () => {
  mockAdmin()

  prisma.category.findFirst.mockResolvedValue(null)
  prisma.category.create.mockRejectedValue(
    new Error('Erro no banco de dados')
  )

  const response = await request(app)
    .post('/api/categories')
    .set('Authorization', `Bearer ${createToken()}`)
    .send({
      name: 'Eventos',
      slug: 'eventos',
    })

  expect(response.status).toBe(500)
  expect(response.body.message).toBe(
    'Erro interno ao cadastrar categoria.'
  )
})

})

describe('PUT /api/categories/:id', () => {
  const categoryId = 'categoria-123'

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = 'segredo-teste-portal138'
  })

  function createToken(userId = 'admin-id') {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )
  }

  function mockAdmin() {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-id',
      name: 'Administrador',
      email: 'admin@teste.com',
      role: 'ADMIN',
    })
  }

  it('deve retornar 401 sem token', async () => {
    const response = await request(app)
      .put(`/api/categories/${categoryId}`)
      .send({ name: 'Eventos atualizados' })

    expect(response.status).toBe(401)
  })

  it('deve retornar 400 quando nenhum campo for enviado', async () => {
    mockAdmin()

    const response = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${createToken()}`)
      .send({})

    expect(response.status).toBe(400)
    expect(response.body.message).toBe(
      'Informe pelo menos um campo para atualizar.'
    )
  })

  it('deve retornar 404 quando a categoria não existir', async () => {
    mockAdmin()
    prisma.category.findUnique.mockResolvedValue(null)

    const response = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${createToken()}`)
      .send({ name: 'Eventos atualizados' })

    expect(response.status).toBe(404)
    expect(response.body.message).toBe('Categoria não encontrada.')
  })

  it('deve atualizar uma categoria existente', async () => {
    mockAdmin()

    prisma.category.findUnique.mockResolvedValue({
      id: categoryId,
      name: 'Eventos',
      slug: 'eventos',
    })

    prisma.category.findFirst.mockResolvedValue(null)

    prisma.category.update.mockResolvedValue({
      id: categoryId,
      name: 'Eventos atualizados',
      slug: 'eventos',
    })

    const response = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${createToken()}`)
      .send({ name: 'Eventos atualizados' })

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Categoria atualizada com sucesso.')
    expect(response.body.category.name).toBe('Eventos atualizados')
    expect(prisma.category.update).toHaveBeenCalled()
  })

  it('deve retornar 500 quando ocorrer um erro ao atualizar categoria', async () => {
  mockAdmin()

  prisma.category.findUnique.mockResolvedValue({
    id: categoryId,
    name: 'Eventos',
    slug: 'eventos',
  })

  prisma.category.findFirst.mockResolvedValue(null)

  prisma.category.update.mockRejectedValue(
    new Error('Erro no banco de dados')
  )

  const response = await request(app)
    .put(`/api/categories/${categoryId}`)
    .set('Authorization', `Bearer ${createToken()}`)
    .send({ name: 'Eventos atualizados' })

  expect(response.status).toBe(500)
  expect(response.body.message).toBe(
    'Erro interno ao editar categoria.'
  )
})

})

describe('DELETE /api/categories/:id', () => {
  const categoryId = 'categoria-123'

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = 'segredo-teste-portal138'
  })

  function createToken(userId = 'admin-id') {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )
  }

  function mockUser(role = 'ADMIN', userId = 'admin-id') {
    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Usuário de teste',
      email: 'usuario@teste.com',
      role,
    })
  }

  it('deve retornar 401 sem token', async () => {
    const response = await request(app)
      .delete(`/api/categories/${categoryId}`)

    expect(response.status).toBe(401)
  })

  it('deve retornar 403 para usuário comum', async () => {
    mockUser('USER', 'usuario-id')

    const response = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${createToken('usuario-id')}`)

    expect(response.status).toBe(403)
  })

  it('deve retornar 404 quando a categoria não existir', async () => {
    mockUser()

    prisma.category.findUnique.mockResolvedValue(null)

    const response = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${createToken()}`)

    expect(response.status).toBe(404)
    expect(response.body.message).toBe('Categoria não encontrada.')
  })

  it('deve retornar 409 quando a categoria possuir notícias vinculadas', async () => {
    mockUser()

    prisma.category.findUnique.mockResolvedValue({
      id: categoryId,
      name: 'Notícias',
      slug: 'noticias',
      _count: {
        posts: 2,
      },
    })

    const response = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${createToken()}`)

    expect(response.status).toBe(409)
    expect(response.body.postsCount).toBe(2)
    expect(prisma.category.delete).not.toHaveBeenCalled()
  })

  it('deve excluir uma categoria sem notícias vinculadas', async () => {
    mockUser()

    prisma.category.findUnique.mockResolvedValue({
      id: categoryId,
      name: 'Eventos',
      slug: 'eventos',
      _count: {
        posts: 0,
      },
    })

    prisma.category.delete.mockResolvedValue({
      id: categoryId,
    })

    const response = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${createToken()}`)

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Categoria excluída com sucesso.')
    expect(prisma.category.delete).toHaveBeenCalledWith({
      where: { id: categoryId },
    })
  })

  it('deve retornar 500 quando ocorrer um erro ao excluir categoria', async () => {
  mockUser()

  prisma.category.findUnique.mockResolvedValue({
    id: categoryId,
    name: 'Eventos',
    slug: 'eventos',
    _count: {
      posts: 0,
    },
  })

  prisma.category.delete.mockRejectedValue(
    new Error('Erro no banco de dados')
  )

  const response = await request(app)
    .delete(`/api/categories/${categoryId}`)
    .set('Authorization', `Bearer ${createToken()}`)

  expect(response.status).toBe(500)
  expect(response.body.message).toBe(
    'Erro interno ao excluir categoria.'
  )
})

})