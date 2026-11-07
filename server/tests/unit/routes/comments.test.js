jest.mock('../../../src/config/prisma', () => ({
  comment: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  post: {
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
}))

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../../../src/app')
const prisma = require('../../../src/config/prisma')

const postId = '12016fa1-cb26-4d8d-8e4d-bfead4dbfbce'

describe('GET /api/comments/post/:postId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deve retornar 400 quando o ID da notícia for inválido', async () => {
    const response = await request(app)
      .get('/api/comments/post/id-invalido')

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('O ID da notícia é inválido.')
  })

  it('deve retornar 404 quando a notícia não existir ou não estiver publicada', async () => {
    prisma.post.findFirst.mockResolvedValue(null)

    const response = await request(app)
      .get(`/api/comments/post/${postId}`)

    expect(response.status).toBe(404)
    expect(response.body.message).toBe('Notícia não encontrada.')
  })

  it('deve listar os comentários e retornar os metadados da paginação', async () => {
    prisma.post.findFirst.mockResolvedValue({ id: postId })
    prisma.comment.findMany.mockResolvedValue([
      {
        id: 'comentario-1',
        content: 'Ótima notícia!',
        createdAt: new Date('2026-01-01T12:00:00.000Z'),
        author: {
          id: 'usuario-1',
          name: 'Usuário Teste',
        },
      },
    ])
    prisma.comment.count.mockResolvedValue(21)

    const response = await request(app)
      .get(`/api/comments/post/${postId}`)

    expect(response.status).toBe(200)
    expect(response.body.comments).toHaveLength(1)
    expect(response.body.comments[0].content).toBe('Ótima notícia!')
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 21,
      totalPages: 3,
    })

    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { postId },
        skip: 0,
        take: 10,
      }),
    )
  })

  it('deve buscar a página solicitada', async () => {
    prisma.post.findFirst.mockResolvedValue({ id: postId })
    prisma.comment.findMany.mockResolvedValue([])
    prisma.comment.count.mockResolvedValue(25)

    const response = await request(app)
      .get(`/api/comments/post/${postId}?page=2`)

    expect(response.status).toBe(200)
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
    })

    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    )
  })

  it.each(['0', '-1', 'abc', '1.5'])(
    'deve retornar 400 para a página inválida %s',
    async (page) => {
      const response = await request(app)
        .get(`/api/comments/post/${postId}?page=${page}`)

      expect(response.status).toBe(400)
      expect(response.body.message).toBe(
        'O número da página deve ser um inteiro maior que zero.',
      )
      expect(prisma.post.findFirst).not.toHaveBeenCalled()
    },
  )

  it('deve retornar 500 quando ocorrer um erro ao listar comentários', async () => {
    prisma.post.findFirst.mockResolvedValue({ id: postId })
    prisma.comment.findMany.mockRejectedValue(
      new Error('Erro no banco de dados'),
    )

    const response = await request(app)
      .get(`/api/comments/post/${postId}`)

    expect(response.status).toBe(500)
    expect(response.body.message).toBe(
      'Erro interno ao listar comentários.',
    )
  })
})

describe('POST /api/comments', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = 'segredo-teste-portal138'
  })

  function createToken(userId = 'usuario-1') {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )
  }

  function mockUser(userId = 'usuario-1') {
    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Usuário Teste',
      email: 'usuario@teste.com',
      role: 'USER',
    })
  }

  it('deve retornar 401 quando não houver token', async () => {
    const response = await request(app)
      .post('/api/comments')
      .send({
        content: 'Meu comentário',
        postId,
      })

    expect(response.status).toBe(401)
  })

  it('deve retornar 400 quando os dados forem inválidos', async () => {
    mockUser()

    const response = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({
        content: '   ',
        postId,
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Dados do comentário inválidos.')
  })

  it('deve retornar 404 quando a notícia não estiver publicada', async () => {
    mockUser()
    prisma.post.findFirst.mockResolvedValue(null)

    const response = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({
        content: 'Meu comentário',
        postId,
      })

    expect(response.status).toBe(404)
    expect(response.body.message).toBe(
      'Notícia não encontrada ou não publicada.'
    )
  })

  it('deve criar um comentário para um usuário autenticado', async () => {
    mockUser()
    prisma.post.findFirst.mockResolvedValue({ id: postId })

    prisma.comment.create.mockResolvedValue({
      id: 'comentario-1',
      content: 'Ótima notícia!',
      createdAt: new Date('2026-01-01T12:00:00.000Z'),
      author: {
        id: 'usuario-1',
        name: 'Usuário Teste',
      },
    })

    const response = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({
        content: 'Ótima notícia!',
        postId,
      })

    expect(response.status).toBe(201)
    expect(response.body.message).toBe('Comentário criado com sucesso.')
    expect(response.body.comment.content).toBe('Ótima notícia!')

    expect(prisma.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          content: 'Ótima notícia!',
          postId,
          authorId: 'usuario-1',
        },
      })
    )
  })

  it('deve retornar 500 quando ocorrer um erro ao criar comentário', async () => {
  mockUser()
  prisma.post.findFirst.mockResolvedValue({ id: postId })
  prisma.comment.create.mockRejectedValue(
    new Error('Erro no banco de dados')
  )

  const response = await request(app)
    .post('/api/comments')
    .set('Authorization', `Bearer ${createToken()}`)
    .send({
      content: 'Meu comentário',
      postId,
    })

  expect(response.status).toBe(500)
  expect(response.body.message).toBe(
    'Erro interno ao criar comentário.'
  )
})

})

describe('DELETE /api/comments/', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = 'segredo-teste-portal138'
  })

  const commentId = 'a12b34cd-1234-4567-8901-abcdef123456'

  function createToken(userId = 'usuario-1') {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )
  }

  function mockUser(userId = 'usuario-1', role = 'USER') {
    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Usuário Teste',
      email: 'usuario@teste.com',
      role,
    })
  }

  it('deve retornar 401 quando não houver token', async () => {
    const response = await request(app)
      .delete(`/api/comments/${commentId}`)

    expect(response.status).toBe(401)
    expect(prisma.comment.findUnique).not.toHaveBeenCalled()
    expect(prisma.comment.delete).not.toHaveBeenCalled()
  })

  it('deve retornar 401 quando o usuário autenticado não existir', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    const response = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set(
        'Authorization',
        `Bearer ${createToken('usuario-inexistente')}`
      )

    expect(response.status).toBe(401)
    expect(response.body.message).toBe('Usuário não encontrado.')
    expect(prisma.comment.findUnique).not.toHaveBeenCalled()
    expect(prisma.comment.delete).not.toHaveBeenCalled()
  })

  it('deve retornar 400 quando o ID do comentário for inválido', async () => {
    mockUser()

    const response = await request(app)
      .delete('/api/comments/id-invalido')
      .set('Authorization', `Bearer ${createToken()}`)

    expect(response.status).toBe(400)
  })

  it('deve retornar 404 quando o comentário não existir', async () => {
    mockUser()
    prisma.comment.findUnique.mockResolvedValue(null)

    const response = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${createToken()}`)

    expect(response.status).toBe(404)
  })

  it('deve retornar 403 quando outro usuário tentar excluir o comentário', async () => {
    mockUser('usuario-2', 'USER')

    prisma.comment.findUnique.mockResolvedValue({
      id: commentId,
      authorId: 'usuario-1',
    })

    const response = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${createToken('usuario-2')}`)

    expect(response.status).toBe(403)
    expect(prisma.comment.delete).not.toHaveBeenCalled()
  })

  it('deve permitir que o autor exclua o próprio comentário', async () => {
    mockUser('usuario-1', 'USER')

    prisma.comment.findUnique.mockResolvedValue({
      id: commentId,
      authorId: 'usuario-1',
    })

    prisma.comment.delete.mockResolvedValue({
      id: commentId,
    })

    const response = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${createToken('usuario-1')}`)

    expect(response.status).toBe(200)
    expect(prisma.comment.delete).toHaveBeenCalledWith({
      where: {
        id: commentId,
      },
    })
  })

  it('deve retornar 500 quando ocorrer um erro ao excluir comentário', async () => {
  mockUser('usuario-1', 'USER')

  prisma.comment.findUnique.mockResolvedValue({
    id: commentId,
    authorId: 'usuario-1',
  })

  prisma.comment.delete.mockRejectedValue(
    new Error('Erro no banco de dados')
  )

  const response = await request(app)
    .delete(`/api/comments/${commentId}`)
    .set('Authorization', `Bearer ${createToken('usuario-1')}`)

  expect(response.status).toBe(500)
  expect(response.body.message).toBe(
    'Erro interno ao excluir comentário.'
  )
})

  it('deve permitir que um administrador exclua o comentário de outro usuário', async () => {
    mockUser('admin-1', 'ADMIN')

    prisma.comment.findUnique.mockResolvedValue({
      id: commentId,
      authorId: 'usuario-1',
    })

    prisma.comment.delete.mockResolvedValue({
      id: commentId,
    })

    const response = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${createToken('admin-1')}`)

    expect(response.status).toBe(200)
    expect(prisma.comment.delete).toHaveBeenCalledWith({
      where: {
        id: commentId,
      },
    })
  })
})