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
const jwt = require('jsonwebtoken')
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

  it('deve filtrar notícias por busca e categoria com ordenação antiga', async () => {
    prisma.$transaction.mockResolvedValue([[], 0])

    const response = await request(app).get(
      '/api/posts?search=tecnologia&categoryId=categoria-1&sort=oldest'
    )

    expect(response.status).toBe(200)

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          title: {
            contains: 'tecnologia',
            mode: 'insensitive',
          },
          categoryId: 'categoria-1',
        }),
        orderBy: [
          { publishedAt: 'asc' },
          { createdAt: 'asc' },
        ],
      })
    )
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

  it('deve retornar 500 quando ocorrer um erro ao listar notícias', async () => {
    prisma.$transaction.mockRejectedValue(new Error('Erro no banco de dados'))

    const response = await request(app).get('/api/posts')

    expect(response.status).toBe(500)
    expect(response.body.message).toBe('Erro ao buscar notícias.')
  })

})

describe('GET /api/posts/admin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = 'segredo-de-teste-jwt'
  })

  function criarToken(userId) {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )
  }

  function configurarUsuario(id, role) {
    prisma.user.findUnique.mockResolvedValue({
      id,
      name: 'Usuário de teste',
      email: 'teste@exemplo.com',
      role,
    })
  }

  it('deve retornar 401 quando não houver token', async () => {
    const response = await request(app).get('/api/posts/admin')

    expect(response.status).toBe(401)
    expect(prisma.post.findMany).not.toHaveBeenCalled()
    expect(prisma.post.count).not.toHaveBeenCalled()
  })

  it('deve retornar 403 para um usuário comum', async () => {
    configurarUsuario('user-teste-id', 'USER')

    const response = await request(app)
      .get('/api/posts/admin')
      .set('Authorization', `Bearer ${criarToken('user-teste-id')}`)

    expect(response.status).toBe(403)
    expect(prisma.post.findMany).not.toHaveBeenCalled()
    expect(prisma.post.count).not.toHaveBeenCalled()
  })

  it.each([
    ['administrador', 'ADMIN', 'admin-teste-id'],
    ['editor', 'EDITOR', 'editor-teste-id'],
  ])('deve permitir acesso ao %s', async (_descricao, role, userId) => {
    configurarUsuario(userId, role)
    prisma.post.findMany.mockResolvedValue([])
    prisma.post.count.mockResolvedValue(0)

    const response = await request(app)
      .get('/api/posts/admin')
      .set('Authorization', `Bearer ${criarToken(userId)}`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      data: [],
      pagination: {
        page: 1,
        limit: 100,
        total: 0,
        totalPages: 0,
      },
    })
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 100,
        orderBy: { updatedAt: 'desc' },
      })
    )
    expect(prisma.post.count).toHaveBeenCalledTimes(1)
  })

  it('deve respeitar a paginação solicitada', async () => {
    configurarUsuario('admin-teste-id', 'ADMIN')
    prisma.post.findMany.mockResolvedValue([])
    prisma.post.count.mockResolvedValue(250)

    const response = await request(app)
      .get('/api/posts/admin?page=2&limit=10')
      .set('Authorization', `Bearer ${criarToken('admin-teste-id')}`)

    expect(response.status).toBe(200)
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 250,
      totalPages: 25,
    })
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      })
    )
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

  it('deve retornar 500 quando ocorrer um erro ao buscar uma notícia', async () => {
  prisma.post.findFirst.mockRejectedValue(
  new Error('Erro no banco de dados')
)

  const response = await request(app)
    .get('/api/posts/noticia-teste')

  expect(response.status).toBe(500)
  expect(response.body.message).toBe(
    'Erro ao buscar notícia.'
  )
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

  it('deve rejeitar uma categoria inexistente', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-teste-id',
      name: 'Administrador Teste',
      email: 'admin@exemplo.com',
      role: 'ADMIN',
    })

    prisma.post.findUnique.mockResolvedValue(null)
    prisma.category.findUnique.mockResolvedValue(null)

    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        title: 'Notícia com categoria inválida',
        slug: 'noticia-categoria-invalida',
        content: 'Conteúdo de teste.',
        categoryId: '12016fa1-cb26-4d8d-8e4d-bfead4dbfbce',
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe(
      'A categoria informada não existe.'
    )
    expect(prisma.post.create).not.toHaveBeenCalled()
  })

  it('deve retornar 500 quando ocorrer um erro ao criar uma notícia', async () => {
  prisma.user.findUnique.mockResolvedValue({
    id: 'admin-teste-id',
    name: 'Administrador Teste',
    email: 'admin@exemplo.com',
    role: 'ADMIN',
  })

  prisma.post.findUnique.mockResolvedValue(null)
  prisma.post.create.mockRejectedValue(
    new Error('Erro no banco de dados')
  )

  const response = await request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${tokenAdmin}`)
    .send({
      title: 'Notícia para teste de erro',
      slug: 'noticia-teste-erro',
      content: 'Conteúdo de teste.',
    })

  expect(response.status).toBe(500)
  expect(response.body.message).toBe(
    'Erro interno ao criar notícia.'
  )
})

})

describe('PUT /api/posts/:id', () => {
  let tokenAdmin
  let tokenEditor
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

    tokenEditor = jwt.sign(
      { userId: 'editor-teste-id' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )

    tokenUser = jwt.sign(
      { userId: 'user-teste-id' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )
  })

  it('deve rejeitar uma edição sem token', async () => {
    const response = await request(app)
      .put('/api/posts/post-teste-id')
      .send({ title: 'Título atualizado' })

    expect(response.status).toBe(401)
  })

  it('deve rejeitar um usuário comum', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-teste-id',
      name: 'Usuário Teste',
      email: 'usuario@exemplo.com',
      role: 'USER',
    })

    const response = await request(app)
      .put('/api/posts/post-teste-id')
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({ title: 'Título atualizado' })

    expect(response.status).toBe(403)
    expect(prisma.post.findUnique).not.toHaveBeenCalled()
  })

  it('deve retornar 404 quando a notícia não existe', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-teste-id',
      name: 'Administrador Teste',
      email: 'admin@exemplo.com',
      role: 'ADMIN',
    })

    prisma.post.findUnique.mockResolvedValue(null)

    const response = await request(app)
      .put('/api/posts/post-inexistente')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ title: 'Título atualizado' })

    expect(response.status).toBe(404)
    expect(response.body.message).toBe('Notícia não encontrada.')
  })

  it('deve rejeitar um status inválido', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-teste-id',
      name: 'Administrador Teste',
      email: 'admin@exemplo.com',
      role: 'ADMIN',
    })

    prisma.post.findUnique.mockResolvedValue({
      id: 'post-teste-id',
      publishedAt: null,
    })

    const response = await request(app)
      .put('/api/posts/post-teste-id')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ status: 'INVALIDO' })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Status inválido.')
    expect(prisma.post.update).not.toHaveBeenCalled()
  })

  it('deve permitir que um editor atualize uma notícia', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'editor-teste-id',
      name: 'Editor Teste',
      email: 'editor@exemplo.com',
      role: 'EDITOR',
    })

    prisma.post.findUnique.mockResolvedValue({
      id: 'post-teste-id',
      publishedAt: null,
    })

    prisma.post.update.mockImplementation(async ({ data }) => ({
      id: 'post-teste-id',
      title: data.title,
    }))

    const response = await request(app)
      .put('/api/posts/post-teste-id')
      .set('Authorization', `Bearer ${tokenEditor}`)
      .send({ title: 'Título atualizado' })

    expect(response.status).toBe(200)
    expect(response.body.message).toBe(
      'Notícia atualizada com sucesso.'
    )
    expect(response.body.post.title).toBe('Título atualizado')
  })

  it('deve definir publishedAt ao publicar uma notícia', async () => {
  prisma.user.findUnique.mockResolvedValue({
    id: 'editor-teste-id',
    name: 'Editor Teste',
    email: 'editor@exemplo.com',
    role: 'EDITOR',
  })

  prisma.post.findUnique.mockResolvedValue({
    id: 'post-teste-id',
    publishedAt: null,
  })

  prisma.post.update.mockImplementation(async ({ data }) => ({
    id: 'post-teste-id',
    status: data.status,
    publishedAt: data.publishedAt,
  }))

  const response = await request(app)
    .put('/api/posts/post-teste-id')
    .set('Authorization', `Bearer ${tokenEditor}`)
    .send({ status: 'PUBLISHED' })

  expect(response.status).toBe(200)
  expect(response.body.post.status).toBe('PUBLISHED')
  expect(response.body.post.publishedAt).toBeTruthy()

  expect(prisma.post.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'post-teste-id' },
      data: expect.objectContaining({
        status: 'PUBLISHED',
        publishedAt: expect.any(Date),
      }),
    })
  )
})

  it('deve preservar publishedAt ao publicar novamente uma notícia', async () => {
  const dataPublicacao = new Date('2026-01-15T12:00:00.000Z')

  prisma.user.findUnique.mockResolvedValue({
    id: 'editor-teste-id',
    name: 'Editor Teste',
    email: 'editor@exemplo.com',
    role: 'EDITOR',
  })

  prisma.post.findUnique.mockResolvedValue({
    id: 'post-teste-id',
    publishedAt: dataPublicacao,
  })

  prisma.post.update.mockImplementation(async ({ data }) => ({
    id: 'post-teste-id',
    status: data.status,
    publishedAt: data.publishedAt,
  }))

  const response = await request(app)
    .put('/api/posts/post-teste-id')
    .set('Authorization', `Bearer ${tokenEditor}`)
    .send({ status: 'PUBLISHED' })

  expect(response.status).toBe(200)
  expect(response.body.post.publishedAt).toBe(dataPublicacao.toISOString())

  expect(prisma.post.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: 'PUBLISHED',
        publishedAt: dataPublicacao,
      }),
    })
  )
})

  it('deve rejeitar a edição quando a categoria não existir', async () => {
  prisma.user.findUnique.mockResolvedValue({
    id: 'editor-teste-id',
    name: 'Editor Teste',
    email: 'editor@exemplo.com',
    role: 'EDITOR',
  })

  prisma.post.findUnique.mockResolvedValue({
    id: 'post-teste-id',
    publishedAt: null,
  })

  prisma.category.findUnique.mockResolvedValue(null)

  const response = await request(app)
    .put('/api/posts/post-teste-id')
    .set('Authorization', `Bearer ${tokenEditor}`)
    .send({
      categoryId: '12016fa1-cb26-4d8d-8e4d-bfead4dbfbce',
    })

  expect(response.status).toBe(400)
  expect(response.body.message).toBe(
    'A categoria informada não existe.'
  )
  expect(prisma.post.update).not.toHaveBeenCalled()
})

  it('deve rejeitar a edição quando o slug já pertence a outra notícia', async () => {
  prisma.user.findUnique.mockResolvedValue({
    id: 'editor-teste-id',
    name: 'Editor Teste',
    email: 'editor@exemplo.com',
    role: 'EDITOR',
  })

  prisma.post.findUnique.mockResolvedValue({
    id: 'noticia-atual-id',
    title: 'Notícia atual',
    slug: 'noticia-atual',
    content: 'Conteúdo atual',
    status: 'DRAFT',
    categoryId: null,
  })

  prisma.post.findFirst.mockResolvedValue({
    id: 'outra-noticia-id',
    slug: 'slug-ocupado',
  })

  const response = await request(app)
    .put('/api/posts/noticia-atual-id')
    .set('Authorization', `Bearer ${tokenEditor}`)
    .send({
      title: 'Notícia atualizada',
      slug: 'slug-ocupado',
      content: 'Conteúdo atualizado',
    })

  expect(response.status).toBe(409)
  expect(response.body.message).toBe(
  'Esse slug já está sendo usado por outra notícia.'
)
  expect(prisma.post.update).not.toHaveBeenCalled()
})

  it('deve retornar 500 quando ocorrer um erro ao editar uma notícia', async () => {
  prisma.user.findUnique.mockResolvedValue({
    id: 'editor-teste-id',
    name: 'Editor Teste',
    email: 'editor@exemplo.com',
    role: 'EDITOR',
  })

  prisma.post.findUnique.mockRejectedValue(
    new Error('Erro no banco de dados')
  )

  const response = await request(app)
    .put('/api/posts/noticia-atual-id')
    .set('Authorization', `Bearer ${tokenEditor}`)
    .send({
      title: 'Título atualizado',
    })

  expect(response.status).toBe(500)
  expect(response.body.message).toBe(
    'Erro interno ao editar notícia.'
  )
})

})

describe('DELETE /api/posts/:id', () => {
  const postId = '12016fa1-cb26-4d8d-8e4d-bfead4dbfbce'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deve retornar 401 quando não houver token', async () => {
    const response = await request(app).delete(`/api/posts/${postId}`)

    expect(response.status).toBe(401)
    expect(response.body).toHaveProperty('message')
  })

  it('deve retornar 403 quando um usuário comum tentar excluir uma notícia', async () => {
    const token = jwt.sign(
      { userId: 'usuario-comum-id' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )

    prisma.user.findUnique.mockResolvedValue({
      id: 'usuario-comum-id',
      name: 'Usuário Comum',
      email: 'usuario@teste.com',
      role: 'USER',
    })

    const response = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(403)
    expect(response.body).toHaveProperty('message')
  })

  it('deve retornar 404 quando a notícia não existir', async () => {
    const token = jwt.sign(
      { userId: 'admin-id' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )

    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-id',
      name: 'Administrador',
      email: 'admin@teste.com',
      role: 'ADMIN',
    })

    prisma.post.findUnique.mockResolvedValue(null)

    const response = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(404)
  })

  it('deve permitir que um administrador exclua uma notícia existente', async () => {
    const token = jwt.sign(
      { userId: 'admin-id' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )

    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-id',
      name: 'Administrador',
      email: 'admin@teste.com',
      role: 'ADMIN',
    })

    prisma.post.findUnique.mockResolvedValue({
      id: postId,
      title: 'Notícia de teste',
    })

    prisma.post.delete.mockResolvedValue({
      id: postId,
      title: 'Notícia de teste',
    })

    const response = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(prisma.post.delete).toHaveBeenCalled()
  })

  it('deve retornar 500 quando ocorrer um erro ao excluir uma notícia', async () => {
  prisma.user.findUnique.mockResolvedValue({
    id: 'admin-teste-id',
    name: 'Administrador Teste',
    email: 'admin@exemplo.com',
    role: 'ADMIN',
  })

  prisma.post.findUnique.mockResolvedValue({
    id: 'noticia-teste-id',
    title: 'Notícia de teste',
    slug: 'noticia-teste',
  })

  prisma.post.delete.mockRejectedValue(
    new Error('Erro no banco de dados')
  )

  const response = await request(app)
    .delete('/api/posts/noticia-teste-id')
    .set(
  'Authorization',
  `Bearer ${jwt.sign(
    { userId: 'admin-teste-id', role: 'ADMIN' },
    process.env.JWT_SECRET || 'test-secret'
  )}`
)

  expect(response.status).toBe(500)
  expect(response.body.message).toBe(
    'Erro interno ao excluir notícia.'
  )
})

})