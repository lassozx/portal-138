const express = require('express')
const request = require('supertest')
const { authLimiter, passwordChangeLimiter } = require('../../../src/middlewares/rateLimit')

it('limita o login por IP e ignora X-Forwarded-For quando o acesso é direto', async () => {
  const app = express()
  app.post('/login', authLimiter, (req, res) => res.sendStatus(401))
  for (let index = 0; index < 10; index++) {
    expect((await request(app).post('/login').set('X-Forwarded-For', `192.0.2.${index + 1}`)).status).toBe(401)
  }
  const response = await request(app).post('/login')
  expect(response.status).toBe(429)
  expect(response.headers['retry-after']).toBeDefined()
})

it('limita tentativas de senha por conta e mantém atualizações de nome disponíveis', async () => {
  const app = express()
  app.use(express.json(), (req, res, next) => { req.user = { id: req.get('X-Test-User') || 'account-a' }; next() })
  app.put('/profile', passwordChangeLimiter, (req, res) => res.sendStatus(req.body.currentPassword ? 400 : 200))
  for (let index = 0; index < 10; index++) {
    expect((await request(app).put('/profile').send({ currentPassword: 'wrong', newPassword: 'New-password-2026' })).status).toBe(400)
  }
  expect((await request(app).put('/profile').send({ currentPassword: 'wrong', newPassword: 'New-password-2026' })).status).toBe(429)
  expect((await request(app).put('/profile').send({ name: 'Novo nome' })).status).toBe(200)
  expect((await request(app).put('/profile').set('X-Test-User', 'account-b').send({ currentPassword: 'wrong' })).status).toBe(400)
})
