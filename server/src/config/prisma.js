const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('A variável DATABASE_URL não foi definida.')
}

const adapter = new PrismaPg({
  connectionString,
})

const prisma = new PrismaClient({
  adapter,
})

module.exports = prisma
