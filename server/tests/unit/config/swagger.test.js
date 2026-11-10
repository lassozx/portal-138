const spec = require('../../../src/config/swagger')

it('gera a documentação das rotas e mantém a autenticação após atualizar o resolvedor de arquivos', () => {
  expect(spec.openapi).toBe('3.0.0')
  for (const route of ['/api/auth/register', '/api/auth/login', '/api/posts', '/api/admin/posts', '/api/categories']) {
    expect(spec.paths).toHaveProperty(route)
  }
  expect(spec.paths['/api/posts'].get).toBeDefined()
  expect(spec.paths['/api/posts'].post).toBeDefined()
  expect(spec.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' })
  expect(spec.servers[0].url).toBe('/')
})
