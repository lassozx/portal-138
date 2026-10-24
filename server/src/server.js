require('dotenv').config()

const app = require('./app')

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Servidor do Portal 138 rodando na porta ${PORT}`)
})