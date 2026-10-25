require('dotenv').config()

const env = require('./config/env')
const app = require('./app')

app.listen(env.PORT, () => {
  console.log(`Servidor do Portal 138 rodando na porta ${env.PORT}`)
})