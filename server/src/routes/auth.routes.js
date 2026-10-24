const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { z } = require('zod')
const prisma = require('../config/prisma')
const { authenticateToken } = require('../middlewares/auth')

const router = express.Router()

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
})

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
})

// Cadastrar usuário público
router.post('/register', async (req, res) => {
  try {
    const validation = registerSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        message: 'Dados inválidos. Informe nome, e-mail válido e senha com pelo menos 8 caracteres.',
        errors: validation.error.issues,
      })
    }

    const { name, email, password } = validation.data
    const normalizedEmail = email.toLowerCase()

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return res.status(409).json({
        message: 'Este e-mail já está cadastrado.',
      })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        // O cadastro público nunca pode escolher o próprio papel.
        role: 'USER',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })

    return res.status(201).json({
      message: 'Usuário cadastrado com sucesso.',
      user,
    })
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        message: 'Este e-mail já está cadastrado.',
      })
    }

    console.error('Erro no cadastro:', error.message)

    return res.status(500).json({
      message: 'Erro interno ao cadastrar usuário.',
    })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const validation = loginSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        message: 'Informe um e-mail válido e uma senha.',
      })
    }

    const { email, password } = validation.data

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      return res.status(401).json({
        message: 'E-mail ou senha incorretos.',
      })
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    )

    if (!passwordMatches) {
      return res.status(401).json({
        message: 'E-mail ou senha incorretos.',
      })
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    )

    return res.json({
      message: 'Login realizado com sucesso.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Erro no login:', error.message)

    return res.status(500).json({
      message: 'Erro interno ao realizar login.',
    })
  }
})

// Verificar usuário autenticado
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    message: 'Usuário autenticado com sucesso.',
    user: req.user,
  })
})

const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).max(72).optional(),
}).refine(
  (data) => data.name !== undefined ||
    data.currentPassword !== undefined ||
    data.newPassword !== undefined,
  { message: 'Informe pelo menos um campo para atualizar.' }
).refine(
  (data) =>
    (data.currentPassword === undefined && data.newPassword === undefined) ||
    (data.currentPassword !== undefined && data.newPassword !== undefined),
  { message: 'Para alterar a senha, informe a senha atual e a nova senha.' }
)

// Atualizar perfil e, opcionalmente, a senha
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const validation = profileSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        message: 'Dados de atualização inválidos.',
        errors: validation.error.issues,
      })
    }

    const { name, currentPassword, newPassword } = validation.data

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    })

    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.',
      })
    }

    const dataToUpdate = {}

    if (name !== undefined) {
      dataToUpdate.name = name
    }

    if (newPassword !== undefined) {
      const passwordMatches = await bcrypt.compare(
        currentPassword,
        user.passwordHash
      )

      if (!passwordMatches) {
        return res.status(400).json({
          message: 'A senha atual está incorreta.',
        })
      }

      dataToUpdate.passwordHash = await bcrypt.hash(newPassword, 12)
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return res.json({
      message: 'Perfil atualizado com sucesso.',
      user: updatedUser,
    })
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error.message)

    return res.status(500).json({
      message: 'Erro interno ao atualizar perfil.',
    })
  }
})

module.exports = router