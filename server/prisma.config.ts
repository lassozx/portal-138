import 'dotenv/config'
import { defineConfig } from 'prisma/config'
import { getPrismaConnectionString } from './src/config/database.js'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: getPrismaConnectionString(),
  },
})
