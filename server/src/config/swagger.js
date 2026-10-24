const path = require('path')
const swaggerJsdoc = require('swagger-jsdoc')

const options = {
definition: {
openapi: '3.0.0',

info: {
  title: 'Portal 138 API',
  version: '1.0.0',
  description:
    'Documentação da API do Portal 138 — notícias, categorias, usuários e comentários.',
},

servers: [
  {
    url: 'http://localhost:3000',
    description: 'Servidor local de desenvolvimento',
  },
],

components: {
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Informe o token JWT obtido no login.',
    },
  },
},

},

apis: [path.join(__dirname, '../routes/*.js')],
}

const swaggerSpec = swaggerJsdoc(options)

module.exports = swaggerSpec