jest.mock('../src/config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}))

const request = require('supertest')
const app = require('../src/app')
const prisma = require('../src/config/prisma')

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deve cadastrar um usuário válido sem expor a senha', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    prisma.user.create.mockImplementation(async ({ data, select }) => ({
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

  it('deve rejeitar dados inválidos', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'A',
        email: 'email-invalido',
        password: '123',
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe(
      'Dados inválidos. Informe nome, e-mail válido e senha com pelo menos 8 caracteres.'
    )

    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(prisma.user.create).not.toHaveBeenCalled()
  })
})