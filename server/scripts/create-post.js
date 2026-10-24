require('dotenv').config()

const prisma = require('../src/config/prisma')

async function main() {
const author = await prisma.user.findUnique({
where: {
email: 'admin@portal138.local',
},
})

if (!author) {
throw new Error('Administrador não encontrado.')
}

const category = await prisma.category.findUnique({
where: {
slug: 'noticias-da-escola',
},
})

if (!category) {
throw new Error('Categoria não encontrada.')
}

const post = await prisma.post.upsert({
where: {
slug: 'bem-vindo-ao-portal-138',
},
update: {},
create: {
title: 'Bem-vindo ao Portal 138',
slug: 'bem-vindo-ao-portal-138',
excerpt:
'Conheça o novo espaço de notícias e informações do SESI 138.',
content:
'O Portal 138 é um espaço dedicado a compartilhar notícias, eventos, projetos e novidades da comunidade escolar do SESI 138. Acompanhe as publicações para ficar por dentro do que acontece na escola.',
status: 'PUBLISHED',
publishedAt: new Date(),
authorId: author.id,
categoryId: category.id,
},
})

console.log('Notícia disponível:')
console.log({
id: post.id,
title: post.title,
slug: post.slug,
status: post.status,
})
}

main()
.catch((error) => {
console.error('Erro ao criar notícia:', error.message)
process.exitCode = 1
})
.finally(async () => {
await prisma.$disconnect()
})
