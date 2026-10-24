require('dotenv').config()

const prisma = require('../src/config/prisma')

async function main() {
const category = await prisma.category.upsert({
where: {
slug: 'noticias-da-escola',
},
update: {},
create: {
name: 'Notícias da Escola',
slug: 'noticias-da-escola',
description: 'Novidades, eventos e comunicados do SESI 138.',
},
})

console.log('Categoria disponível:')
console.log(category)
}

main()
.catch((error) => {
console.error('Erro ao criar categoria:', error.message)
process.exitCode = 1
})
.finally(async () => {
await prisma.$disconnect()
})
