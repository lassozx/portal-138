const express = require('express')
const { z } = require('zod')
const prisma = require('../config/prisma')
const { authenticateToken, authorizeRoles } = require('../middlewares/auth')

const router = express.Router()
const createPostSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  excerpt: z.string().trim().max(500).optional().nullable(),
  content: z.string().trim().min(1),
  coverImage: z.string().trim().max(2048).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
})

const updatePostSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(200)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    excerpt: z.string().trim().max(500).optional().nullable(),
    content: z.string().trim().min(1).optional(),
    coverImage: z.string().trim().max(2048).optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    status: z
  .enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'], {
    error: 'Status inválido.',
  })
  .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe pelo menos um campo para atualizar.',
  })

/**
 * @swagger
 * tags:
 *   name: Notícias
 *   description: Consulta e gerenciamento de notícias
 */

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: Listar notícias publicadas
 *     tags: [Notícias]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Quantidade de notícias por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar pelo título
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filtrar pelo ID da categoria
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [latest, oldest]
 *           default: latest
 *         description: Ordenação por data
 *     responses:
 *       200:
 *         description: Lista paginada de notícias
 *       400:
 *         description: Parâmetros inválidos
 *       500:
 *         description: Erro interno
 *
 * /api/posts/{slug}:
 *   get:
 *     summary: Buscar notícia publicada pelo slug
 *     tags: [Notícias]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Identificador textual da notícia
 *     responses:
 *       200:
 *         description: Notícia encontrada
 *       404:
 *         description: Notícia não encontrada
 *       500:
 *         description: Erro interno
 */

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Criar notícia como rascunho
 *     tags: [Notícias]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, slug, content]
 *             properties:
 *               title:
 *                 type: string
 *               slug:
 *                 type: string
 *               excerpt:
 *                 type: string
 *                 nullable: true
 *               content:
 *                 type: string
 *               coverImage:
 *                 type: string
 *                 nullable: true
 *               categoryId:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Notícia criada como rascunho
 *       400:
 *         description: Dados inválidos ou categoria inexistente
 *       401:
 *         description: Token ausente ou inválido
 *       403:
 *         description: Permissão insuficiente
 *       409:
 *         description: Slug já existente
 *       500:
 *         description: Erro interno
 *
 * /api/posts/{id}:
 *   put:
 *     summary: Editar notícia
 *     tags: [Notícias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da notícia
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               slug:
 *                 type: string
 *               excerpt:
 *                 type: string
 *                 nullable: true
 *               content:
 *                 type: string
 *               coverImage:
 *                 type: string
 *                 nullable: true
 *               categoryId:
 *                 type: string
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, ARCHIVED]
 *     responses:
 *       200:
 *         description: Notícia atualizada
 *       400:
 *         description: Dados inválidos ou categoria inexistente
 *       401:
 *         description: Token ausente ou inválido
 *       403:
 *         description: Permissão insuficiente
 *       404:
 *         description: Notícia não encontrada
 *       409:
 *         description: Slug já utilizado
 *       500:
 *         description: Erro interno
 *
 *   delete:
 *     summary: Excluir notícia
 *     tags: [Notícias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da notícia
 *     responses:
 *       200:
 *         description: Notícia excluída
 *       401:
 *         description: Token ausente ou inválido
 *       403:
 *         description: Apenas administradores podem excluir notícias
 *       404:
 *         description: Notícia não encontrada
 *       500:
 *         description: Erro interno
 */

// Listar notícias publicadas com paginação, filtros e ordenação
router.get('/', async (req, res) => {
  try {
    const rawPage = req.query.page
    const rawLimit = req.query.limit

    const page = rawPage === undefined ? 1 : Number(rawPage)
    const limit = rawLimit === undefined ? 10 : Number(rawLimit)

    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        message:
          'A página deve ser um inteiro positivo e o limite deve ser um inteiro entre 1 e 100.',
      })
    }

    const search =
      typeof req.query.search === 'string'
        ? req.query.search.trim()
        : ''

    const categoryId =
      typeof req.query.categoryId === 'string'
        ? req.query.categoryId.trim()
        : ''

    const sort =
      typeof req.query.sort === 'string'
        ? req.query.sort.trim().toLowerCase()
        : 'latest'

    if (!['latest', 'oldest'].includes(sort)) {
      return res.status(400).json({
        message: 'Ordenação inválida. Use "latest" ou "oldest".',
      })
    }

    const where = {
      status: 'PUBLISHED',
      publishedAt: {
        lte: new Date(),
      },
    }

    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive',
      }
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    const direction = sort === 'oldest' ? 'asc' : 'desc'

    const [posts, total] = await prisma.$transaction([
      prisma.post.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              name: true,
            },
          },
          category: true,
        },
        orderBy: [
          { publishedAt: direction },
          { createdAt: direction },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ])

    return res.json({
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Erro ao listar notícias:', error.message)

    return res.status(500).json({
      message: 'Erro ao buscar notícias.',
    })
  }
})

// Buscar uma notícia publicada pelo slug
// Listar todas as notícias para o painel administrativo
router.get(
  '/admin',
  authenticateToken,
  authorizeRoles('ADMIN', 'EDITOR'),
  async (req, res) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
      const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 100))
      const skip = (page - 1) * limit

      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            author: { select: { id: true, name: true } },
            category: true,
          },
        }),
        prisma.post.count(),
      ])

      return res.json({
        data: posts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      console.error('Erro ao listar notícias administrativas:', error)
      return res.status(500).json({
        message: 'Erro interno ao listar notícias.',
      })
    }
  },
)

router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params

    const post = await prisma.post.findFirst({
      where: {
        slug,
        status: 'PUBLISHED',
        publishedAt: {
          lte: new Date(),
        },
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        category: true,
      },
    })

    if (!post) {
      return res.status(404).json({
        message: 'Notícia não encontrada.',
      })
    }

    return res.json(post)
  } catch (error) {
    console.error('Erro ao buscar notícia:', error.message)

    return res.status(500).json({
      message: 'Erro ao buscar notícia.',
    })
  }
})

// Criar notícia (somente ADMIN e EDITOR)
router.post(
  '/',
  authenticateToken,
  authorizeRoles('ADMIN', 'EDITOR'),
  async (req, res) => {
    try {
      const validation = createPostSchema.safeParse(req.body)

      if (!validation.success) {
        const requiredFields = ['title', 'slug', 'content']

        const missingRequiredFields = requiredFields.some(
          (field) =>
            req.body?.[field] === undefined ||
            req.body?.[field] === null ||
            req.body?.[field] === '',
        )

        return res.status(400).json({
          message: missingRequiredFields
            ? 'Título, slug e conteúdo são obrigatórios.'
            : 'Dados da notícia inválidos.',
          errors: validation.error.issues,
        })
      }

      const { title, slug, excerpt, content, coverImage, categoryId } =
        validation.data

      const existingPost = await prisma.post.findUnique({
        where: { slug },
      })

      if (existingPost) {
        return res.status(409).json({
          message: 'Já existe uma notícia com esse slug.',
        })
      }

      if (categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: categoryId },
        })

        if (!category) {
          return res.status(400).json({
            message: 'A categoria informada não existe.',
          })
        }
      }

      const post = await prisma.post.create({
        data: {
          title,
          slug,
          excerpt: excerpt || null,
          content,
          coverImage: coverImage || null,
          status: 'DRAFT',
          authorId: req.user.id,
          categoryId: categoryId || null,
        },
      })

      return res.status(201).json({
        message: 'Notícia criada como rascunho.',
        post,
      })
    } catch (error) {
      console.error('Erro ao criar notícia:', error.message)

      return res.status(500).json({
        message: 'Erro interno ao criar notícia.',
      })
    }
  }
)

// Editar notícia (somente ADMIN e EDITOR)
router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('ADMIN', 'EDITOR'),
  async (req, res) => {
    try {
      const { id } = req.params
      const validation = updatePostSchema.safeParse(req.body)

            if (!validation.success) {
        const invalidStatus = validation.error.issues.some(
          (issue) => issue.path[0] === 'status',
        )

        return res.status(400).json({
          message: invalidStatus
            ? 'Status inválido.'
            : 'Dados de atualização inválidos.',
          errors: validation.error.issues,
        })
      }

      const {
        title,
        slug,
        excerpt,
        content,
        coverImage,
        categoryId,
        status,
      } = validation.data

      const existingPost = await prisma.post.findUnique({
        where: { id },
      })

      if (!existingPost) {
        return res.status(404).json({
          message: 'Notícia não encontrada.',
        })
      }

      const data = {}

      if (title !== undefined) data.title = title
      if (slug !== undefined) data.slug = slug
      if (excerpt !== undefined) data.excerpt = excerpt
      if (content !== undefined) data.content = content
      if (coverImage !== undefined) data.coverImage = coverImage
      if (categoryId !== undefined) data.categoryId = categoryId || null

      if (status !== undefined) {
        const allowedStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED']

        if (!allowedStatuses.includes(status)) {
          return res.status(400).json({
            message: 'Status inválido.',
          })
        }

        data.status = status
        data.publishedAt =
          status === 'PUBLISHED'
            ? existingPost.publishedAt || new Date()
            : null
      }

      if (data.slug) {
        const slugInUse = await prisma.post.findFirst({
          where: {
            slug: data.slug,
            NOT: { id },
          },
        })

        if (slugInUse) {
          return res.status(409).json({
            message: 'Esse slug já está sendo usado por outra notícia.',
          })
        }
      }

      if (data.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: data.categoryId },
        })

        if (!category) {
          return res.status(400).json({
            message: 'A categoria informada não existe.',
          })
        }
      }

      const updatedPost = await prisma.post.update({
        where: { id },
        data,
      })

      return res.json({
        message: 'Notícia atualizada com sucesso.',
        post: updatedPost,
      })
    } catch (error) {
      console.error('Erro ao editar notícia:', error.message)

      return res.status(500).json({
        message: 'Erro interno ao editar notícia.',
      })
    }
  }
)

// Excluir notícia (somente ADMIN)
router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  async (req, res) => {
    try {
      const { id } = req.params

      const existingPost = await prisma.post.findUnique({
        where: { id },
      })

      if (!existingPost) {
        return res.status(404).json({
          message: 'Notícia não encontrada.',
        })
      }

      await prisma.post.delete({
        where: { id },
      })

      return res.json({
        message: 'Notícia excluída com sucesso.',
      })
    } catch (error) {
      console.error('Erro ao excluir notícia:', error.message)

      return res.status(500).json({
        message: 'Erro interno ao excluir notícia.',
      })
    }
  }
)

module.exports = router