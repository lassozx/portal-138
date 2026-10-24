const request = require('supertest')
const app = require('../src/app')
const prisma = require('../src/config/prisma')

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /api/health', () => {
  it('deve retornar 200 e confirmar que a API está funcionando', async () => {
    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      status: 'ok',
      message: 'API do Portal 138 funcionando!',
    })
  })
})

describe('GET /api/health/database', () => {
  it('deve confirmar que a conexão com o PostgreSQL funciona', async () => {
    const response = await request(app).get('/api/health/database')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      status: 'ok',
      message: 'Conexão com o PostgreSQL funcionando!',
    })
  })
})