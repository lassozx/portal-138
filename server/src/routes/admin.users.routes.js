const express = require('express')
const bcrypt = require('bcryptjs')
const { z } = require('zod')
const prisma = require('../config/prisma')
const { authenticateToken, authorizeRoles } = require('../middlewares/auth')

const router = express.Router()
const publicFields = { id: true, name: true, email: true, role: true, createdAt: true }
const roleSchema = z.enum(['ADMIN', 'EDITOR', 'USER'])
const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).default(''),
  role: roleSchema.optional(),
})
const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12, 'Use uma senha com pelo menos 12 caracteres.')
    .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'A senha deve ter no máximo 72 bytes em UTF-8.'),
  role: roleSchema,
}).strict()

router.use(authenticateToken, authorizeRoles('ADMIN'))

router.get('/', async (req, res, next) => {
  const validation = listSchema.safeParse(req.query)
  if (!validation.success) return res.status(400).json({ message: 'Filtros de usuários inválidos.' })
  const { page, limit, search, role } = validation.data
  const where = {
    ...(role ? { role } : {}),
    ...(search ? { OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ] } : {}),
  }
  try {
    const [total, data] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({ where, select: publicFields, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
    ])
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
  } catch (error) { next(error) }
})

router.post('/', async (req, res, next) => {
  const validation = createSchema.safeParse(req.body)
  if (!validation.success) return res.status(400).json({ message: validation.error.issues[0].message })
  const { name, email, password, role } = validation.data
  try {
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({ data: { name, email: email.toLowerCase(), passwordHash, role }, select: publicFields })
    res.status(201).json({ message: 'Conta criada com sucesso.', user })
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ message: 'Este e-mail já está cadastrado.' })
    next(error)
  }
})

router.patch('/:id/role', async (req, res, next) => {
  const validation = z.object({ role: roleSchema }).strict().safeParse(req.body)
  if (!validation.success) return res.status(400).json({ message: 'Escolha um perfil válido: usuário, editor ou administrador.' })
  if (req.params.id === req.user.id) return res.status(409).json({ message: 'Você não pode alterar o próprio perfil de acesso.' })
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock administrators in a consistent order and recheck the actor after waiting.
      // Two administrators cannot simultaneously revoke each other's access.
      await tx.$queryRaw`SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY id FOR UPDATE`
      const actor = await tx.user.findUnique({ where: { id: req.user.id }, select: { role: true } })
      if (actor?.role !== 'ADMIN') return { status: 403, message: 'Seu acesso administrativo foi alterado. Entre novamente.' }
      const target = await tx.user.findUnique({ where: { id: req.params.id }, select: publicFields })
      if (!target) return { status: 404, message: 'Usuário não encontrado.' }
      const user = await tx.user.update({ where: { id: target.id }, data: { role: validation.data.role }, select: publicFields })
      return { status: 200, message: 'Perfil de acesso atualizado com sucesso.', user }
    })
    const { status, ...body } = result
    res.status(status).json(body)
  } catch (error) { next(error) }
})

module.exports = router
