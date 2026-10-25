require('dotenv').config()

const bcrypt = require('bcryptjs')
const prisma = require('../src/config/prisma')
const readline = require('readline')
const { randomUUID } = require('crypto')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function perguntar(pergunta) {
  return new Promise((resolve) => {
    rl.question(pergunta, resolve)
  })
}

function perguntarSenha(pergunta) {
  return new Promise((resolve) => {
    const stdin = process.stdin
    let senha = ''

    process.stdout.write(pergunta)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    function aoDigitar(tecla) {
      if (tecla === '\u0003') {
        process.stdout.write('\nOperação cancelada.\n')
        process.exit(130)
      }

      if (tecla === '\r' || tecla === '\n') {
        stdin.removeListener('data', aoDigitar)
        stdin.setRawMode(false)
        process.stdout.write('\n')
        resolve(senha)
        return
      }

      if (tecla === '\u007f' || tecla === '\b') {
        senha = senha.slice(0, -1)
        return
      }

      if (tecla >= ' ') {
        senha += tecla
      }
    }

    stdin.on('data', aoDigitar)
  })
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Execute este script diretamente em um terminal interativo.')
  }

  const name = (await perguntar('Nome do administrador: ')).trim()
  const email = (await perguntar('E-mail do administrador: '))
    .trim()
    .toLowerCase()
  const password = await perguntarSenha('Senha do administrador: ')

  if (
    name.length < 2 ||
    name.length > 100 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 12 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    throw new Error(
      'Dados inválidos. Informe um nome válido, e-mail válido e senha entre 12 e 72 bytes.',
    )
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    throw new Error('Este e-mail já está cadastrado. Nenhum usuário foi alterado.')
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

  console.log('\nAdministrador criado com sucesso:')
  console.log(user)
}

main()
  .catch((error) => {
    console.error('\nErro:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    rl.close()
    await prisma.$disconnect()
  })