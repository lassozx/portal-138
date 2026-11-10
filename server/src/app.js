const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const prisma = require('./config/prisma')
const postsRoutes = require('./routes/posts.routes')
const adminPostsRoutes = require('./routes/admin.posts.routes')
const authRoutes = require('./routes/auth.routes')
const categoriesRoutes = require('./routes/categories.routes')
const commentsRoutes = require('./routes/comments.routes')
const errorHandler = require('./middlewares/errorHandler')
const swaggerUi = require('swagger-ui-express')
const swaggerSpec = require('./config/swagger')
const { getRuntimeConfig } = require('./config/runtime')
const { createClientRouter } = require('./middlewares/client')

const runtime = getRuntimeConfig()
const app = express()
app.set('trust proxy', runtime.trustProxy)

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      baseUri: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      upgradeInsecureRequests: runtime.isProduction ? [] : null,
    },
  },
  frameguard: { action: 'deny' },
}))
app.use(cors({ origin: runtime.allowedOrigins.length ? runtime.allowedOrigins : !runtime.isProduction }))
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
// Consulta administrativa separada dos slugs públicos das notícias
app.use('/api/admin/posts', adminPostsRoutes)
app.use('/api/admin/users', require('./routes/admin.users.routes'))
app.use('/api/uploads', require('./routes/uploads.routes'))
// Rotas públicas de notícias
app.use('/api/posts', postsRoutes)
app.use('/api/categories', categoriesRoutes)
app.use('/api/comments', commentsRoutes)
app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint não encontrado.' }))
if (runtime.serveClient) app.use(createClientRouter(runtime.clientDirectory))
app.use((req, res) => res.status(404).json({ message: 'Recurso não encontrado.' }))
app.use(errorHandler)

module.exports = app
