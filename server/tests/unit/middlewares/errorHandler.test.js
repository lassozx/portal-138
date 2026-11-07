const errorHandler = require('../../../src/middlewares/errorHandler')

describe('Middleware global de erros', () => {
let req
let res
let next

beforeEach(() => {
jest.clearAllMocks()
jest.spyOn(console, 'error').mockImplementation(() => {})

req = {
  method: 'GET',
  originalUrl: '/api/teste',
}

res = {
  headersSent: false,
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
}

next = jest.fn()

})

afterEach(() => {
jest.restoreAllMocks()
})

it('deve retornar 500 com mensagem genérica para erros inesperados', () => {
const error = new Error('Detalhe interno confidencial')

errorHandler(error, req, res, next)

expect(res.status).toHaveBeenCalledWith(500)
expect(res.json).toHaveBeenCalledWith({
  status: 'error',
  message: 'Erro interno do servidor.',
})
expect(res.json).not.toHaveBeenCalledWith(
  expect.objectContaining({
    message: 'Detalhe interno confidencial',
  })
)
expect(next).not.toHaveBeenCalled()

})

it('deve preservar um código de erro válido', () => {
const error = new Error('Dados inválidos')
error.statusCode = 400

errorHandler(error, req, res, next)

expect(res.status).toHaveBeenCalledWith(400)
expect(res.json).toHaveBeenCalledWith({
  status: 'error',
  message: 'Dados inválidos',
})

})

it('deve usar 500 quando o código de erro for inválido', () => {
const error = new Error('Erro de teste')
error.statusCode = 200

errorHandler(error, req, res, next)

expect(res.status).toHaveBeenCalledWith(500)
expect(res.json).toHaveBeenCalledWith({
  status: 'error',
  message: 'Erro interno do servidor.',
})

})

it('deve encaminhar o erro quando os cabeçalhos já foram enviados', () => {
const error = new Error('Resposta já iniciada')
res.headersSent = true

errorHandler(error, req, res, next)

expect(next).toHaveBeenCalledWith(error)
expect(res.status).not.toHaveBeenCalled()
expect(res.json).not.toHaveBeenCalled()

})

it('deve usar uma mensagem genérica quando o erro não tiver mensagem', () => {
  const error = new Error()
  error.statusCode = 400
  error.message = ''

  errorHandler(error, req, res, next)

  expect(res.status).toHaveBeenCalledWith(400)
  expect(res.json).toHaveBeenCalledWith({
    status: 'error',
    message: 'Ocorreu um erro na requisição.',
  })
})

it('deve retornar 500 quando o código de erro for menor que 400', () => {
  const error = new Error('Erro de teste')
  error.statusCode = 399

  errorHandler(error, req, res, next)

  expect(res.status).toHaveBeenCalledWith(500)
  expect(res.json).toHaveBeenCalledWith({
    status: 'error',
    message: 'Erro interno do servidor.',
  })
})

})
