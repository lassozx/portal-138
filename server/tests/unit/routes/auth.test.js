jest.mock('../../../src/config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}))

jest.mock('../../../src/middlewares/rateLimit', () => ({
  authLimiter: (req, res, next) => next(),
  passwordChangeLimiter: (req, res, next) => next(),
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../../../src/app')
const prisma = require('../../../src/config/prisma')
const bcrypt = require('bcryptjs')

const passwordsAtLimit = [
  ['ASCII', 'a'.repeat(72)],
  ['acentos', 'á'.repeat(36)],
  ['emojis', '😀'.repeat(18)],
]
const passwordsAboveLimit = [
  ['ASCII', 'a'.repeat(73)],
  ['acentos', 'á'.repeat(36) + 'X'],
  ['emojis', '😀'.repeat(18) + 'X'],
]

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deve cadastrar um usuário válido sem expor a senha', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    prisma.user.create.mockImplementation(async ({ data }) => ({
      id: 'usuario-teste-id',
      name: data.name,
      email: data.email,
      role: data.role,
      createdAt: new Date('2026-01-01T12:00:00.000Z'),
    }))

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Usuario Teste',
        email: 'NOVO.USUARIO@EXEMPLO.COM',
        password: 'SenhaSegura123',
        role: 'ADMIN',
      })

    expect(response.status).toBe(201)
    expect(response.body.message).toBe('Usuário cadastrado com sucesso.')
    expect(response.body.user).toMatchObject({
      id: 'usuario-teste-id',
      name: 'Usuario Teste',
      email: 'novo.usuario@exemplo.com',
      role: 'USER',
    })
    expect(response.body.user).not.toHaveProperty('password')
    expect(response.body.user).not.toHaveProperty('passwordHash')
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'novo.usuario@exemplo.com',
          role: 'USER',
        }),
      })
    )
  })

  it.each(passwordsAboveLimit)('rejeita cadastro com senha de 73 bytes (%s) antes de gerar hash', async (_, password) => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Usuario Teste',
      email: 'novo@exemplo.com',
      password,
    })

    expect(response.status).toBe(400)
    expect(response.body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ['password'] }),
    ]))
    expect(response.body.message).toContain('A senha é muito longa.')
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(bcrypt.hash).not.toHaveBeenCalled()
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it.each(passwordsAtLimit)('aceita cadastro com senha de exatamente 72 bytes (%s)', async (_, password) => {
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.user.create.mockResolvedValue({ id: 'usuario-teste-id', role: 'USER' })
    bcrypt.hash.mockResolvedValue('hash-de-senha')

    const response = await request(app).post('/api/auth/register').send({
      name: 'Usuario Teste',
      email: 'novo@exemplo.com',
      password,
    })

    expect(response.status).toBe(201)
    expect(bcrypt.hash).toHaveBeenCalledWith(password, 12)
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ passwordHash: 'hash-de-senha' }),
    }))
  })

  it('deve rejeitar um e-mail já cadastrado', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'usuario-existente-id',
      email: 'existente@exemplo.com',
    })

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Usuario Novo',
        email: 'existente@exemplo.com',
        password: 'SenhaSegura123',
      })

    expect(response.status).toBe(409)
    expect(response.body.message).toBe('Este e-mail já está cadastrado.')
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('deve retornar 409 quando o banco detectar um e-mail duplicado', async () => {
  prisma.user.findUnique.mockResolvedValue(null)

  prisma.user.create.mockRejectedValue({
    code: 'P2002',
    message: 'Unique constraint failed',
  })

  const response = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Usuario Teste',
      email: 'duplicado@exemplo.com',
      password: 'SenhaSegura123',
    })

  expect(response.status).toBe(409)
  expect(response.body.message).toBe(
    'Este e-mail já está cadastrado.'
  )
})

  it('deve rejeitar dados inválidos no cadastro', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'A',
        email: 'email-invalido',
        password: '123',
      })

    expect(response.status).toBe(400)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('deve retornar 500 quando ocorrer um erro inesperado no cadastro', async () => {
  prisma.user.findUnique.mockResolvedValue(null)
  prisma.user.create.mockRejectedValue(
    new Error('Erro no banco de dados')
  )

  const response = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Usuario Teste',
      email: 'novo@exemplo.com',
      password: 'SenhaSegura123',
    })

  expect(response.status).toBe(500)
  expect(response.body.message).toBe(
    'Erro interno ao cadastrar usuário.'
  )
})

})

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = 'segredo-de-teste-jwt'
    process.env.JWT_EXPIRES_IN = '1h'
  })

  it.each(['SenhaSegura123', 'á'.repeat(36) + 'X'])('autentica e retorna JWT, inclusive para senha legada acima de 72 bytes (%s)', async (password) => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'usuario-teste-id',
      name: 'Usuario Teste',
      email: 'usuario@exemplo.com',
      passwordHash: 'hash-de-senha',
      role: 'USER',
    })
    bcrypt.compare.mockResolvedValue(true)

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'USUARIO@EXEMPLO.COM',
        password,
      })

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Login realizado com sucesso.')
    expect(response.body.token).toBeDefined()
    expect(response.body.user).toEqual({
      id: 'usuario-teste-id',
      name: 'Usuario Teste',
      email: 'usuario@exemplo.com',
      role: 'USER',
    })
    expect(response.body.user).not.toHaveProperty('passwordHash')
    expect(bcrypt.compare).toHaveBeenCalledWith(password, 'hash-de-senha')

    const decoded = jwt.verify(
      response.body.token,
      process.env.JWT_SECRET
    )
    expect(decoded.userId).toBe('usuario-teste-id')

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'usuario@exemplo.com' },
    })
  })

  it('deve usar expiração padrão de 1 hora quando JWT_EXPIRES_IN não estiver definido', async () => {
  const originalExpiresIn = process.env.JWT_EXPIRES_IN
  delete process.env.JWT_EXPIRES_IN

  try {
    prisma.user.findUnique.mockResolvedValue({
      id: 'usuario-teste-id',
      name: 'Usuario Teste',
      email: 'usuario@exemplo.com',
      passwordHash: 'hash-de-senha',
      role: 'USER',
    })
    bcrypt.compare.mockResolvedValue(true)

    const antes = Math.floor(Date.now() / 1000)

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'usuario@exemplo.com',
        password: 'SenhaSegura123',
      })

    const depois = Math.floor(Date.now() / 1000)

    expect(response.status).toBe(200)

    const decoded = jwt.verify(
      response.body.token,
      process.env.JWT_SECRET
    )

    expect(decoded.exp - decoded.iat).toBe(3600)
    expect(decoded.iat).toBeGreaterThanOrEqual(antes)
    expect(decoded.iat).toBeLessThanOrEqual(depois)
  } finally {
    if (originalExpiresIn === undefined) {
      delete process.env.JWT_EXPIRES_IN
    } else {
      process.env.JWT_EXPIRES_IN = originalExpiresIn
    }
  }
})

  it('deve rejeitar uma senha incorreta', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'usuario-teste-id',
      email: 'usuario@exemplo.com',
      passwordHash: 'hash-de-senha',
      role: 'USER',
    })
    bcrypt.compare.mockResolvedValue(false)

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'usuario@exemplo.com',
        password: 'SenhaErrada123',
      })

    expect(response.status).toBe(401)
    expect(response.body.message).toBe('E-mail ou senha incorretos.')
    expect(response.body.token).toBeUndefined()
  })

  it('deve rejeitar um e-mail inexistente', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'inexistente@exemplo.com',
        password: 'SenhaSegura123',
      })

    expect(response.status).toBe(401)
    expect(response.body.message).toBe('E-mail ou senha incorretos.')
    expect(bcrypt.compare).not.toHaveBeenCalled()
  })

  it('deve rejeitar dados inválidos no login', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'email-invalido',
        password: '',
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe(
      'Informe um e-mail válido e uma senha.'
    )
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('deve retornar 500 quando ocorrer um erro inesperado no login', async () => {
  prisma.user.findUnique.mockRejectedValue(
    new Error('Erro no banco de dados')
  )

  const response = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'usuario@exemplo.com',
      password: 'SenhaSegura123',
    })

  expect(response.status).toBe(500)
  expect(response.body.message).toBe(
    'Erro interno ao realizar login.'
  )
})

})

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = 'segredo-de-teste-jwt'
  })

  it('deve retornar os dados do usuário autenticado', async () => {
    const token = jwt.sign(
      { userId: 'usuario-teste-id' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )

    prisma.user.findUnique.mockResolvedValue({
      id: 'usuario-teste-id',
      name: 'Usuario Teste',
      email: 'usuario@exemplo.com',
      role: 'USER',
    })

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.user).toEqual({
      id: 'usuario-teste-id',
      name: 'Usuario Teste',
      email: 'usuario@exemplo.com',
      role: 'USER',
    })
  })

  it('deve rejeitar uma requisição sem token', async () => {
    const response = await request(app)
      .get('/api/auth/me')

    expect(response.status).toBe(401)
  })

  it('deve rejeitar um token inválido', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token-invalido')

    expect(response.status).toBe(401)
  })

it('deve rejeitar um token expirado', async () => {
    const token = jwt.sign(
      { userId: 'usuario-teste-id' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' },
    )

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(401)
    expect(response.body.message).toBe('Token inválido ou expirado.')
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('deve rejeitar um token assinado com outra chave', async () => {
    const token = jwt.sign(
      { userId: 'usuario-teste-id' },
      'outra-chave-de-teste',
      { expiresIn: '1h' },
    )

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(401)
    expect(response.body.message).toBe('Token inválido ou expirado.')
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

})

describe('PUT /api/auth/profile', () => {
  const userId = 'usuario-teste-id'

  let token

  const existingUser = {
    id: userId,
    name: 'Usuario Teste',
    email: 'usuario@exemplo.com',
    passwordHash: 'hash-senha-atual',
    role: 'USER',
    createdAt: new Date('2026-01-01T12:00:00.000Z'),
  }

  const updatedUser = {
    id: userId,
    name: 'Nome Atualizado',
    email: 'usuario@exemplo.com',
    role: 'USER',
    createdAt: new Date('2026-01-01T12:00:00.000Z'),
    updatedAt: new Date('2026-01-02T12:00:00.000Z'),
  }

  beforeEach(() => {
    jest.clearAllMocks()

    process.env.JWT_SECRET = 'segredo-de-teste-jwt'

    token = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
    )

    prisma.user.findUnique.mockResolvedValue(existingUser)
  })

  it('deve atualizar o nome do usuário', async () => {
    prisma.user.update.mockResolvedValue(updatedUser)

    const response = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nome Atualizado' })

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Perfil atualizado com sucesso.')
    expect(response.body.user.name).toBe('Nome Atualizado')

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId, sessionVersion: 0 },
        data: { name: 'Nome Atualizado' },
      }),
    )
  })

  it('deve retornar 500 quando ocorrer um erro inesperado ao atualizar o perfil', async () => {
  prisma.user.update.mockRejectedValue(
    new Error('Erro no banco de dados')
  )

  const response = await request(app)
    .put('/api/auth/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Nome Atualizado' })

  expect(response.status).toBe(500)
  expect(response.body.message).toBe(
    'Erro interno ao atualizar perfil.'
  )
})

  it('não atualiza usando uma versão de sessão revogada enquanto a requisição estava em andamento', async () => {
    prisma.user.update.mockRejectedValue({ code: 'P2025' })
    const response = await request(app).put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`).send({ name: 'Novo nome' })
    expect(response.status).toBe(401)
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: userId, sessionVersion: 0 },
    }))
  })

  it('deve rejeitar uma atualização sem campos', async () => {
    const response = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Dados de atualização inválidos.')
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('deve rejeitar um nome muito curto', async () => {
    const response = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A' })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Dados de atualização inválidos.')
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('deve exigir a senha atual ao informar uma nova senha', async () => {
    const response = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'NovaSenhaSegura123' })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Dados de atualização inválidos.')
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('deve retornar 404 quando o usuário não existir', async () => {
  prisma.user.findUnique
    .mockResolvedValueOnce({
      id: userId,
      name: 'Usuario Teste',
      email: 'usuario@exemplo.com',
      role: 'USER',
    })
    .mockResolvedValueOnce(null)

  const response = await request(app)
    .put('/api/auth/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Nome Atualizado' })

  expect(response.status).toBe(404)
  expect(response.body.message).toBe('Usuário não encontrado.')
  expect(prisma.user.findUnique).toHaveBeenCalledTimes(2)
  expect(prisma.user.update).not.toHaveBeenCalled()
})

  it('deve rejeitar a alteração quando a senha atual estiver incorreta', async () => {
    bcrypt.compare.mockResolvedValue(false)

    const response = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'SenhaErrada123',
        newPassword: 'NovaSenhaSegura123',
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('A senha atual está incorreta.')
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it.each(['SenhaAtual123', 'á'.repeat(36) + 'X'])('altera a senha mesmo quando a senha atual é legada acima de 72 bytes (%s)', async (currentPassword) => {
    bcrypt.compare.mockResolvedValue(true)
    bcrypt.hash.mockResolvedValue('novo-hash-de-senha')

    prisma.user.update.mockResolvedValue({
      ...updatedUser,
      name: existingUser.name,
    })

    const response = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword,
        newPassword: 'NovaSenhaSegura123',
      })

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Perfil atualizado com sucesso.')

    expect(bcrypt.compare).toHaveBeenCalledWith(
      currentPassword,
      'hash-senha-atual',
    )

    expect(bcrypt.hash).toHaveBeenCalledWith(
      'NovaSenhaSegura123',
      12,
    )

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId, sessionVersion: 0 },
        data: { passwordHash: 'novo-hash-de-senha', sessionVersion: { increment: 1 } },
      }),
    )

    expect(response.body.user).not.toHaveProperty('passwordHash')
  })

  it.each(passwordsAboveLimit)('rejeita troca para senha de 73 bytes (%s) antes de gerar hash', async (_, newPassword) => {
    const response = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'SenhaAtual123', newPassword })

    expect(response.status).toBe(400)
    expect(response.body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ['newPassword'] }),
    ]))
    expect(response.body.message).toContain('A senha é muito longa.')
    expect(bcrypt.compare).not.toHaveBeenCalled()
    expect(bcrypt.hash).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it.each(passwordsAtLimit)('aceita troca para senha de exatamente 72 bytes (%s)', async (_, newPassword) => {
    bcrypt.compare.mockResolvedValue(true)
    bcrypt.hash.mockResolvedValue('novo-hash-de-senha')
    prisma.user.update.mockResolvedValue(updatedUser)

    const response = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'SenhaAtual123', newPassword })

    expect(response.status).toBe(200)
    expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12)
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { passwordHash: 'novo-hash-de-senha', sessionVersion: { increment: 1 } },
    }))
  })

  it('deve retornar 401 quando não houver token', async () => {
    const response = await request(app)
      .put('/api/auth/profile')
      .send({ name: 'Nome Atualizado' })

    expect(response.status).toBe(401)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
