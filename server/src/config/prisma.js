const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')
const { getDatabaseOptions } = require('./database')

const adapter = new PrismaPg(getDatabaseOptions())

const prisma = new PrismaClient({
  adapter,
})

module.exports = prisma
