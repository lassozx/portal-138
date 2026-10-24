require('dotenv').config()

const bcrypt = require('bcryptjs')
const { randomUUID } = require('crypto')
const prisma = require('../src/config/prisma')

async function main() {
const name = 'Administrador Portal 138'
const email = 'admin@portal138.local'
const password = 'Portal138@Dev2026'

const existingUser = await prisma.user.findUnique({
where: { email },
})

if (existingUser) {
console.log('O usuário administrador já existe.')
return
}

const passwordHash = await bcrypt.hash(password, 12)

const user = await prisma.user.create({
data: {
id: randomUUID(),
name,
email,
passwordHash,
role: 'ADMIN',
},
select: {
id: true,
name: true,
email: true,
role: true,
},
})

console.log('Administrador criado com sucesso:')
console.log(user)
console.log('Senha inicial:', password)
}

main()
.catch((error) => {
console.error('Erro ao criar administrador:', error.message)
process.exitCode = 1
})
.finally(async () => {
await prisma.$disconnect()
})
