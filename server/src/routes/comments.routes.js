const express = require('express')
const { z } = require('zod')
const prisma = require('../config/prisma')
const { authenticateToken, authorizeRoles } = require('../middlewares/auth')

const router = express.Router()

const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'O comentário não pode estar vazio.')
    .max(2000, 'O comentário deve ter no máximo 2000 caracteres.'),
  postId: z.string().uuid('O ID da notícia é inválido.'),
})


/**
 * @swagger
 * tags:
 *   name: Comentários
 *   description: Consulta e gerenciamento de comentários das notícias
 */

/**
 * @swagger
 * /api/comments/post/{postId}:
 *   get:
 *     summary: Listar comentários de uma notícia publicada
 *     tags: [Comentários]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da notícia
 *     responses:
 *       200:
 *         description: Lista de comentários, do mais recente ao mais antigo
 *       400:
 *         description: ID da notícia inválido
 *       404:
 *         description: Notícia não encontrada ou não publicada
 *       500:
 *         description: Erro interno
 *
 * /api/comments:
 *   post:
 *     summary: Criar comentário em uma notícia publicada
 *     tags: [Comentários]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content, postId]
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *                 example: Excelente notícia!
 *               postId:
 *                 type: string
 *                 format: uuid
 *                 description: ID da notícia publicada
 *     responses:
 *       201:
 *         description: Comentário criado
 *       400:
 *         description: Conteúdo ou ID da notícia inválido
 *       401:
 *         description: Token ausente ou inválido
 *       404:
 *         description: Notícia não encontrada ou não publicada
 *       500:
 *         description: Erro interno
 *
 * /api/comments/{id}:
 *   delete:
 *     summary: Excluir comentário próprio ou como administrador
 *     tags: [Comentários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do comentário
 *     responses:
 *       200:
 *         description: Comentário excluído
 *       400:
 *         description: ID do comentário inválido
 *       401:
 *         description: Token ausente ou inválido
 *       403:
 *         description: Usuário não é autor nem administrador
 *       404:
 *         description: Comentário não encontrado
 *       500:
 *         description: Erro interno
 */

// Listar comentários de uma notícia publicada
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params

    if (!z.string().uuid().safeParse(postId).success) {
      return res.status(400).json({
        message: 'O ID da notícia é inválido.',
      })
    }

    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        status: 'PUBLISHED',
        publishedAt: { lte: new Date() },
      },
      select: { id: true },
    })

    if (!post) {
      return res.status(404).json({
        message: 'Notícia não encontrada.',
      })
    }

    const comments = await prisma.comment.findMany({
      where: { postId },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return res.json(comments)
  } catch (error) {
    console.error('Erro ao listar comentários:', error.message)

    return res.status(500).json({
      message: 'Erro interno ao listar comentários.',
    })
  }
})

// Criar comentário: usuário autenticado
router.post('/', authenticateToken, async (req, res) => {
  try {
    const validation = commentSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        message: 'Dados do comentário inválidos.',
        errors: validation.error.issues,
      })
    }

    const { content, postId } = validation.data

    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        status: 'PUBLISHED',
        publishedAt: { lte: new Date() },
      },
      select: { id: true },
    })

    if (!post) {
      return res.status(404).json({
        message: 'Notícia não encontrada ou não publicada.',
      })
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        postId,
        authorId: req.user.id,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return res.status(201).json({
      message: 'Comentário criado com sucesso.',
      comment,
    })
  } catch (error) {
    console.error('Erro ao criar comentário:', error.message)

    return res.status(500).json({
      message: 'Erro interno ao criar comentário.',
    })
  }
})

// Excluir comentário: autor ou administrador
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params

    if (!z.string().uuid().safeParse(id).success) {
      return res.status(400).json({
        message: 'O ID do comentário é inválido.',
      })
    }

    const comment = await prisma.comment.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
      },
    })

    if (!comment) {
      return res.status(404).json({
        message: 'Comentário não encontrado.',
      })
    }

    const isAuthor = comment.authorId === req.user.id
    const isAdmin = req.user.role === 'ADMIN'

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        message: 'Você só pode excluir seus próprios comentários.',
      })
    }

    await prisma.comment.delete({
      where: { id },
    })

    return res.json({
      message: 'Comentário excluído com sucesso.',
    })
  } catch (error) {
    console.error('Erro ao excluir comentário:', error.message)

    return res.status(500).json({
      message: 'Erro interno ao excluir comentário.',
    })
  }
})

module.exports = router