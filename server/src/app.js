const express = require('express')
const cors = require('cors')
const prisma = require('./config/prisma')
const postsRoutes = require('./routes/posts.routes')
const authRoutes = require('./routes/auth.routes')
const categoriesRoutes = require('./routes/categories.routes')
const commentsRoutes = require('./routes/comments.routes')
const errorHandler = require('./middlewares/errorHandler')
const swaggerUi = require('swagger-ui-express')
const swaggerSpec = require('./config/swagger')

const app = express()

app.use(cors())
app.use(express.json())
// Documentação interativa da API
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// Verifica se a API está funcionando
app.get('/api/health', (req, res) => {
res.json({
status: 'ok',
message: 'API do Portal 138 funcionando!',
})
})

// Verifica a conexão com o PostgreSQL
app.get('/api/health/database', async (req, res) => {
try {
await prisma.$queryRaw`SELECT 1`

res.json({
  status: 'ok',
  message: 'Conexão com o PostgreSQL funcionando!',
})

} catch (error) {
console.error('Erro ao conectar ao banco:', error.message)

res.status(500).json({
  status: 'error',
  message: 'Não foi possível conectar ao banco de dados.',
})

}
})

// Rotas de autenticação
app.use('/api/auth', authRoutes)
// Rotas públicas de notícias
app.use('/api/posts', postsRoutes)
app.use('/api/categories', categoriesRoutes)
app.use('/api/comments', commentsRoutes)
app.use(errorHandler)

module.exports = app
