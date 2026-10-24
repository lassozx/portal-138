const express = require('express')
const { z } = require('zod')
const prisma = require('../config/prisma')
const {
  authenticateToken,
  authorizeRoles,
} = require('../middlewares/auth')

const router = express.Router()

const categorySchema = z.object({
  name: z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres.'),
  slug: z
    .string()
    .trim()
    .min(2, 'O slug deve ter pelo menos 2 caracteres.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'O slug deve conter apenas letras minúsculas, números e hífens.'),
  description: z.string().trim().optional().nullable(),
})


/**
 * @swagger
 * tags:
 *   name: Categorias
 *   description: Consulta e gerenciamento de categorias de notícias
 */

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Listar categorias
 *     tags: [Categorias]
 *     responses:
 *       200:
 *         description: Lista de categorias com contagem de notícias
 *       500:
 *         description: Erro interno
 *
 *   post:
 *     summary: Criar categoria
 *     tags: [Categorias]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, slug]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *               slug:
 *                 type: string
 *                 minLength: 2
 *                 pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
 *               description:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Categoria criada
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Token ausente ou inválido
 *       403:
 *         description: Permissão insuficiente
 *       409:
 *         description: Nome ou slug já existente
 *       500:
 *         description: Erro interno
 *
 * /api/categories/{id}:
 *   put:
 *     summary: Atualizar categoria
 *     tags: [Categorias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da categoria
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *               slug:
 *                 type: string
 *                 minLength: 2
 *                 pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
 *               description:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Categoria atualizada
 *       400:
 *         description: Dados inválidos ou nenhum campo informado
 *       401:
 *         description: Token ausente ou inválido
 *       403:
 *         description: Permissão insuficiente
 *       404:
 *         description: Categoria não encontrada
 *       409:
 *         description: Nome ou slug já existente
 *       500:
 *         description: Erro interno
 *
 *   delete:
 *     summary: Excluir categoria
 *     tags: [Categorias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da categoria
 *     responses:
 *       200:
 *         description: Categoria excluída
 *       401:
 *         description: Token ausente ou inválido
 *       403:
 *         description: Apenas administradores podem excluir categorias
 *       404:
 *         description: Categoria não encontrada
 *       409:
 *         description: Categoria possui notícias vinculadas
 *       500:
 *         description: Erro interno
 */

// Listar categorias (público)
router.get('/', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    })

    return res.json(categories)
  } catch (error) {
    console.error('Erro ao listar categorias:', error.message)

    return res.status(500).json({
      message: 'Erro interno ao listar categorias.',
    })
  }
})

// Cadastrar categoria (ADMIN e EDITOR)
router.post(
  '/',
  authenticateToken,
  authorizeRoles('ADMIN', 'EDITOR'),
  async (req, res) => {
    try {
      const validation = categorySchema.safeParse(req.body)

      if (!validation.success) {
        return res.status(400).json({
          message: 'Dados da categoria inválidos.',
          errors: validation.error.issues,
        })
      }

      const { name, slug, description } = validation.data

      const existingCategory = await prisma.category.findFirst({
        where: {
          OR: [{ name }, { slug }],
        },
      })

      if (existingCategory) {
        return res.status(409).json({
          message: 'Já existe uma categoria com esse nome ou slug.',
        })
      }

      const category = await prisma.category.create({
        data: {
          name,
          slug,
          description: description || null,
        },
      })

      return res.status(201).json({
        message: 'Categoria criada com sucesso.',
        category,
      })
    } catch (error) {
      console.error('Erro ao cadastrar categoria:', error.message)

      return res.status(500).json({
        message: 'Erro interno ao cadastrar categoria.',
      })
    }
  }
)

// Editar categoria (ADMIN e EDITOR)
router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('ADMIN', 'EDITOR'),
  async (req, res) => {
    try {
      const { id } = req.params

      const validation = categorySchema
        .partial()
        .safeParse(req.body)

      if (!validation.success) {
        return res.status(400).json({
          message: 'Dados da categoria inválidos.',
          errors: validation.error.issues,
        })
      }

      const data = validation.data

      if (Object.keys(data).length === 0) {
        return res.status(400).json({
          message: 'Informe pelo menos um campo para atualizar.',
        })
      }

      const existingCategory = await prisma.category.findUnique({
        where: { id },
      })

      if (!existingCategory) {
        return res.status(404).json({
          message: 'Categoria não encontrada.',
        })
      }

      if (data.name !== undefined || data.slug !== undefined) {
        const duplicate = await prisma.category.findFirst({
          where: {
            AND: [
              { id: { not: id } },
              {
                OR: [
                  ...(data.name !== undefined
                    ? [{ name: data.name }]
                    : []),
                  ...(data.slug !== undefined
                    ? [{ slug: data.slug }]
                    : []),
                ],
              },
            ],
          },
        })

        if (duplicate) {
          return res.status(409).json({
            message: 'Já existe uma categoria com esse nome ou slug.',
          })
        }
      }

      const updatedCategory = await prisma.category.update({
        where: { id },
        data,
      })

      return res.json({
        message: 'Categoria atualizada com sucesso.',
        category: updatedCategory,
      })
    } catch (error) {
      console.error('Erro ao editar categoria:', error.message)

      return res.status(500).json({
        message: 'Erro interno ao editar categoria.',
      })
    }
  }
)

// Excluir categoria (somente ADMIN)
router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  async (req, res) => {
    try {
      const { id } = req.params

      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              posts: true,
            },
          },
        },
      })

      if (!category) {
        return res.status(404).json({
          message: 'Categoria não encontrada.',
        })
      }

      if (category._count.posts > 0) {
        return res.status(409).json({
          message: 'Não é possível excluir uma categoria que possui notícias vinculadas.',
          postsCount: category._count.posts,
        })
      }

      await prisma.category.delete({
        where: { id },
      })

      return res.json({
        message: 'Categoria excluída com sucesso.',
      })
    } catch (error) {
      console.error('Erro ao excluir categoria:', error.message)

      return res.status(500).json({
        message: 'Erro interno ao excluir categoria.',
      })
    }
  }
)

module.exports = router
