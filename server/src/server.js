require('dotenv').config({ quiet: true })

const env = require('./config/env')
const app = require('./app')
const prisma = require('./config/prisma')

const server = app.listen(env.PORT, error => {
  if (error) return
  console.log(`Servidor do Portal 138 rodando na porta ${env.PORT}`)
})

let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`Encerrando o Portal 138 (${signal}).`)
  const timeout = setTimeout(() => {
    server.closeAllConnections()
    process.exit(1)
  }, 10000)
  timeout.unref()
  server.close(async error => {
    try {
      await prisma.$disconnect()
      clearTimeout(timeout)
      process.exit(error ? 1 : 0)
    } catch {
      console.error('Não foi possível encerrar a conexão com o banco.')
      process.exit(1)
    }
  })
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
server.on('error', async error => {
  const message = error.code === 'EADDRINUSE'
    ? `A porta ${env.PORT} já está em uso. Encerre a outra instância da API ou escolha outra PORT.`
    : `Não foi possível iniciar o servidor: ${error.message}`
  console.error(message)
  try {
    await prisma.$disconnect()
  } finally {
    process.exit(1)
  }
})
