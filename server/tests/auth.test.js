jest.mock('../src/config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../src/app')
const prisma = require('../src/config/prisma')
const bcrypt = require('bcryptjs')

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
})

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = 'segredo-de-teste-jwt'
    process.env.JWT_EXPIRES_IN = '1h'
  })

  it('deve autenticar o usuário e retornar um JWT válido', async () => {
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
        password: 'SenhaSegura123',
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

    const decoded = jwt.verify(
      response.body.token,
      process.env.JWT_SECRET
    )
    expect(decoded.userId).toBe('usuario-teste-id')

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'usuario@exemplo.com' },
    })
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
})